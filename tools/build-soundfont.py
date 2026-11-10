# Baut den Soundfont der App: Gitarren aus GeneralUser GS, alles andere aus Sonivox.
#
#   python3 -I tools/build-soundfont.py <sonivox.sf2> <GeneralUser-GS.sf2> <ausgabe.sf2>
#
# GeneralUser GS v2.0 (S. Christian Collins) darf in Software verwendet und angepasst werden,
# siehe vendor/alphatab/soundfont/LICENSE-GeneralUser-GS.txt.
import struct
import sys

GUITARS = range(24, 32)  # GM-Programme 24–31: Nylon, Steel, Jazz, Clean, Muted, Overdrive, Distortion, Harmonics

GEN_ATTENUATION = 48
GEN_INSTRUMENT = 41
GEN_SAMPLE = 53

# GeneralUser GS regelt die Lautstärke über Modulatoren, die alphaTab nicht auswertet. Dadurch lagen die
# Gitarren bis zu 12 dB auseinander. Diese Anhebung in dB wurde an gerenderten Akkorden gemessen:
# Ziel ist ein gemeinsamer Pegel, ohne dass ein Akkord übersteuert.
GAIN_DB = {24: 3.4, 25: 13.0, 26: 0.9, 27: 3.0, 28: -1.9, 29: 3.8, 30: 6.2, 31: 4.1}
PAD = 46  # Laut Spezifikation folgen jedem Sample mindestens 46 Nullwerte


def read_chunks(data, start, end):
    pos = start
    while pos + 8 <= end:
        cid = data[pos:pos + 4].decode('latin1')
        size = struct.unpack_from('<I', data, pos + 4)[0]
        yield cid, pos + 8, size
        pos += 8 + size + (size & 1)


class Font:
    def __init__(self, path):
        data = open(path, 'rb').read()
        assert data[:4] == b'RIFF' and data[8:12] == b'sfbk', f'{path} ist kein SoundFont'
        self.smpl = b''
        pdta = {}
        for cid, off, size in read_chunks(data, 12, len(data)):
            if cid != 'LIST':
                continue
            kind = data[off:off + 4].decode('latin1')
            for sub, soff, ssize in read_chunks(data, off + 4, off + size):
                if kind == 'sdta' and sub == 'smpl':
                    self.smpl = data[soff:soff + ssize]
                elif kind == 'pdta':
                    pdta[sub] = data[soff:soff + ssize]
        rec = lambda name, size, fmt: [struct.unpack_from(fmt, pdta[name], i) for i in range(0, len(pdta[name]), size)]
        self.phdr = rec('phdr', 38, '<20sHHHIII')
        self.pbag = rec('pbag', 4, '<HH')
        self.pmod = [pdta['pmod'][i:i + 10] for i in range(0, len(pdta['pmod']), 10)]
        self.pgen = rec('pgen', 4, '<HH')
        self.inst = rec('inst', 22, '<20sH')
        self.ibag = rec('ibag', 4, '<HH')
        self.imod = [pdta['imod'][i:i + 10] for i in range(0, len(pdta['imod']), 10)]
        self.igen = rec('igen', 4, '<HH')
        self.shdr = rec('shdr', 46, '<20sIIIIIBbHH')

    def presets(self):
        # Ohne den Abschlusseintrag "EOP"
        for i in range(len(self.phdr) - 1):
            name, preset, bank, bag, lib, genre, morph = self.phdr[i]
            yield i, name, preset, bank


class Builder:
    def __init__(self):
        self.phdr, self.pbag, self.pmod, self.pgen = [], [], [], []
        self.inst, self.ibag, self.imod, self.igen = [], [], [], []
        self.shdr, self.smpl = [], bytearray()

    def add_presets(self, font, wanted, gain_db=None):
        inst_map, sample_map = {}, {}

        def add_sample(si):
            if si in sample_map:
                return sample_map[si]
            name, start, end, sloop, eloop, rate, pitch, corr, link, stype = font.shdr[si]
            new = len(self.shdr)
            sample_map[si] = new
            base = len(self.smpl) // 2
            self.smpl += font.smpl[start * 2:end * 2] + b'\0' * (PAD * 2)
            self.shdr.append([name, base, base + end - start, base + sloop - start, base + eloop - start, rate, pitch, corr, link, stype])
            # Stereo-Paare: das verknüpfte Sample mitnehmen und den Verweis umschreiben
            if stype in (2, 4) and link < len(font.shdr) - 1:
                self.shdr[new][8] = add_sample(link)
            return new

        def add_instrument(ii):
            if ii in inst_map:
                return inst_map[ii]
            name, bag0 = font.inst[ii]
            bag1 = font.inst[ii + 1][1]
            new = len(self.inst)
            inst_map[ii] = new
            self.inst.append((name, len(self.ibag)))
            for b in range(bag0, bag1):
                g0, m0 = font.ibag[b]
                g1, m1 = font.ibag[b + 1]
                self.ibag.append((len(self.igen), len(self.imod)))
                self.imod.extend(font.imod[m0:m1])
                for oper, amount in font.igen[g0:g1]:
                    self.igen.append((oper, add_sample(amount) if oper == GEN_SAMPLE else amount))
            return new

        added = 0
        for i, name, preset, bank in font.presets():
            if not wanted(preset, bank):
                continue
            bag0 = font.phdr[i][3]
            bag1 = font.phdr[i + 1][3]
            self.phdr.append((name, preset, bank, len(self.pbag), 0, 0, 0))
            gain = (gain_db or {}).get(preset, 0)
            signed = lambda a: a - 0x10000 if a >= 0x8000 else a
            # Eine erste Zone ohne Instrument ist die globale Zone: ihre Werte gelten für alle anderen Zonen,
            # solange eine Zone keinen eigenen Wert hat. Ein eigener Wert ersetzt den globalen.
            first = dict(font.pgen[font.pbag[bag0][0]:font.pbag[bag0 + 1][0]]) if bag1 > bag0 else {}
            global_att = signed(first[GEN_ATTENUATION]) if GEN_INSTRUMENT not in first and GEN_ATTENUATION in first else 0
            for b in range(bag0, bag1):
                g0, m0 = font.pbag[b]
                g1, m1 = font.pbag[b + 1]
                self.pbag.append((len(self.pgen), len(self.pmod)))
                self.pmod.extend(font.pmod[m0:m1])
                gens = list(font.pgen[g0:g1])
                if gain and any(o == GEN_INSTRUMENT for o, _ in gens):
                    # Wirksame Dämpfung dieser Zone in Zentibel, um die Anhebung verringert (negativ heißt lauter).
                    own = [k for k, (o, _) in enumerate(gens) if o == GEN_ATTENUATION]
                    current = signed(gens[own[0]][1]) if own else global_att
                    value = (current - round(gain * 10)) & 0xFFFF
                    if own:
                        gens[own[0]] = (GEN_ATTENUATION, value)
                    else:
                        gens.insert(len(gens) - 1, (GEN_ATTENUATION, value))
                for oper, amount in gens:
                    self.pgen.append((oper, add_instrument(amount) if oper == GEN_INSTRUMENT else amount))
            added += 1
        return added

    def write(self, path, info):
        # Abschlusseinträge, die die Spezifikation verlangt
        phdr = self.phdr + [(b'EOP', 0, 0, len(self.pbag), 0, 0, 0)]
        pbag = self.pbag + [(len(self.pgen), len(self.pmod))]
        pmod = self.pmod + [b'\0' * 10]
        pgen = self.pgen + [(0, 0)]
        inst = self.inst + [(b'EOI', len(self.ibag))]
        ibag = self.ibag + [(len(self.igen), len(self.imod))]
        imod = self.imod + [b'\0' * 10]
        igen = self.igen + [(0, 0)]
        shdr = [tuple(s) for s in self.shdr] + [(b'EOS', 0, 0, 0, 0, 0, 0, 0, 0, 0)]

        def chunk(cid, body):
            return cid.encode('latin1') + struct.pack('<I', len(body)) + body + (b'\0' if len(body) & 1 else b'')

        def lst(kind, body):
            return chunk('LIST', kind.encode('latin1') + body)

        def zstr(text):
            raw = text.encode('latin1') + b'\0'
            return raw + (b'\0' if len(raw) & 1 else b'')

        info_body = chunk('ifil', struct.pack('<HH', 2, 1)) + chunk('isng', zstr('EMU8000'))
        for cid, text in info:
            info_body += chunk(cid, zstr(text))
        pdta = b''.join([
            chunk('phdr', b''.join(struct.pack('<20sHHHIII', *r) for r in phdr)),
            chunk('pbag', b''.join(struct.pack('<HH', *r) for r in pbag)),
            chunk('pmod', b''.join(pmod)),
            chunk('pgen', b''.join(struct.pack('<HH', *r) for r in pgen)),
            chunk('inst', b''.join(struct.pack('<20sH', *r) for r in inst)),
            chunk('ibag', b''.join(struct.pack('<HH', *r) for r in ibag)),
            chunk('imod', b''.join(imod)),
            chunk('igen', b''.join(struct.pack('<HH', *r) for r in igen)),
            chunk('shdr', b''.join(struct.pack('<20sIIIIIBbHH', *r) for r in shdr)),
        ])
        body = b'sfbk' + lst('INFO', info_body) + lst('sdta', chunk('smpl', bytes(self.smpl))) + lst('pdta', pdta)
        with open(path, 'wb') as f:
            f.write(b'RIFF' + struct.pack('<I', len(body)) + body)


def main():
    sonivox_path, generaluser_path, out = sys.argv[1:4]
    sonivox, generaluser = Font(sonivox_path), Font(generaluser_path)
    b = Builder()
    n_gu = b.add_presets(generaluser, lambda preset, bank: bank == 0 and preset in GUITARS, GAIN_DB)
    n_sv = b.add_presets(sonivox, lambda preset, bank: not (bank == 0 and preset in GUITARS))
    b.write(out, [
        ('INAM', 'Guitarhero'),
        ('ICOP', 'Gitarren: GeneralUser GS v2.0.3 von S. Christian Collins. Übrige Instrumente: Sonivox.'),
        ('ICMT', 'Zusammengestellt mit tools/build-soundfont.py'),
    ])
    print(f'{n_gu} Gitarren aus GeneralUser GS, {n_sv} weitere Presets aus Sonivox, '
          f'{len(b.shdr)} Samples, {len(b.smpl) / 1e6:.1f} MB Audiodaten')


if __name__ == '__main__':
    main()
