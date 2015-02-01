#!/usr/bin/python

try:
  import signal
  signal.signal(signal.SIGPIPE, signal.SIG_DFL)
except:
  pass

import sys, struct

def fail(msg):
  sys.stderr.write(msg + '\n')
  sys.exit(1)
if len(sys.argv) < 2: fail('usage: %s foo.gblorb' % sys.argv[0])
gblorb = open(sys.argv[1]).read()
i = gblorb.find('Glul\x00')
if i == -1: fail('not a .glulx or .gblorb file')
glulx = gblorb[i:]
u8 = lambda addr: ord(glulx[addr])
u32 = lambda addr: struct.unpack_from('!I', glulx, addr)[0]

ram_start = u32(8)
string_table_start = u32(28)
string_table_size = u32(string_table_start)
string_table_end = string_table_start + string_table_size
huffman_root = u32(string_table_start + 8)
code_start, code_end = 0, string_table_start
data_start, data_end = string_table_end, ram_start

def decode_u8(addr):
  end = glulx.find('\x00', addr)
  if end == -1: return
  return glulx[addr:end].decode('latin1')

def decode_u32(addr):
  result = []
  while True:
    v = u32(addr)
    if v == 0: return u''.join(result)
    result.append(unichr(v))
    addr += 4

def decode_huffman(addr):
  result = []
  p = huffman_root
  bit = -1
  while True:
    bit += 1
    if bit == 8:
      bit = 0
      addr += 1
    v = (u8(addr) >> bit) & 1
    assert u8(p) == 0
    p = u32(p + 1 + 4*v)
    op = u8(p)
    if op == 0: continue
    elif op == 1: return u''.join(result)
    elif op == 2: result.append(unichr(u8(p+1)))
    elif op == 3: result.append(decode_u8(p+1))
    elif op == 4: result.append(unichr(u32(p+1)))
    elif op == 5: result.append(decode_u32(p+1))
    else: result.append(u'<<???>>')
    p = huffman_root

def find_strings():
  visited = set()
  for i in xrange(code_start, code_end):
    p = u32(i)
    if p < data_start or p >= data_end: continue
    if glulx[p] == '\xe1': s = decode_huffman(p+1)
    elif glulx[p:p+4] == '\xe2\x00\x00\x00': s = decode_u32(p+4)
    elif glulx[p] == '\xe0': s = decode_u8(i+1)
    else: s = None
    if s: yield s, p, i

def main():
  for s, p, i in find_strings():
    if not s: continue
    s = s.rstrip()
    if not s: continue
    print(s.encode('utf8'))

main()
