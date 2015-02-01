# glulx-strings

extract raw text fragments from interactive fiction glulx gblorb Inform

Okay, so, maybe you've written a shiny new text adventure game in
Inform 7 and sent the .gblorb out to your testers and then accidentally
drop your computer over the side of your boat and the backups are
a lie and you don't care that much about the game logic but you
really want to get all that prose back.  Or maybe you're playing a
text adventure game and you've gotten really invested but you got
stuck halfway through and you've been banging your head against it
for weeks but there are no hints or they aren't doing it for you
and you've broken down and searched everywhere for a walkthrough
or a forum thread, anything, nope, crickets.

Anyway this thing takes the contents of a gblorb file (containing
a Glulx game -- doesn't support Z-machine, sorry) and extracts the
text.  Typically this includes all of the printable text in the
game, often including various internal identifiers that might or
might not actually be printable but are nonetheless in there so the
game can try to emit helpful diagnostics in case it finds itself
in an unexpected situation and does not know how else to proceed.

[I feel like an example would be helpful.  Maybe I can come up with
one later and stick it here.]

You would think this would be super easy -- I mean normally when
you have a computer program and you want to see the text it contains,
you can run something like the `strings` Unix command on it, which
mostly just looks through the file for any sequence of 4 or more
consecutive printable ASCII characters and shows you those, which
is surprisingly effective.  But for Glulx (and Z-code) this tends
not to work, because the text is usually compressed, using a Huffman
encoding scheme.  I guess back in the Infocom days it was important
to do this in order to be able to fit more game on a floppy disk,
and I assume that the practice has persisted because there was no
compelling reason to stop doing it and also because it makes it
that much harder to cheat.  [Erm.  Sorry about that.]

Anyway!  I think the strategy used by this glulx-strings thing
you're looking at is interesting -- normally you'd need a disassembler,
basically, but at least right now the ones I've seen seem to be a
bit old and stale, and the problem with that approach is that if
they see some opcode they don't understand, they can't proceed.
Whereas this thing doesn't even try to understand, it just flails
around and decodes everything that looks like it might be possibly
probably almost certainly a string of text, so it does less but it
isn't as brittle.  And actually it turns out you can apply a few
simple heuristics to greatly cut down on the amount of noise, if
you even care, which you probably don't that much really.  Maybe
I'll write more about all that later.

Anyway for now I've just posted my initial Python implementation,
but it occurred to me that it would be way better to do this in
Javascript, because I am assuming that you are probably a human
being and most human beings do not know off the top of their heads
how to run a Python program and get it to do something useful, and
those who do have some idea of what's involved often have better
things to do with their time, whereas if this thing is Javascript
it can live on a web page and you can just drag the file onto the
page and it can show you the text, bam, done.

So I'mma work on that maybe.

## Let's see here.

So actually I think I can just write the code right in here, right?
And then `coffee -l` will extract the code bits and compile them
and it'll all be good.  Probably!

Let us begin.

I want this to be a module exporting a function that takes, uh, a
buffer-like thing, file contents, array of unsigned bytes, and...
let's make it asynchronous, so it repeatedly invokes a callback
with one string each time, and then returns.  Not that that's really
asynchronous, exactly, but it's... incremental?  The caller knows
it's got the last string when the function has returned.  The
callback won't get invoked again later.  It's purely synchronous,
really.

Let's call this function, uh, extract_strings.

    exports.extract_strings = (bytes, cb) ->

Okay, so, first thing we need to do is... I'm assuming most people
are going to want to pass in a .gblorb, because most games come
packaged that way... er, most IF games written with Inform 7, I
should say?  As opposed to a plain Glulx file, is what I mean.  So
we first need to find the Glulx.  And so a .gblorb is some kind of
IFF file and we could parse it and find the right chunk, or we could
just say screw that and look for the Glulx header, and that way
this'll work even if it's some other kind of file with a .gblorb
and/or Glulx embedded in it, so long as it's not like compressed
or encoded in some other fancy way.

The header is 36 bytes long and starts with the 4-byte sequence
"Glul" (the "magic number") followed by a big-endian version number
whose first byte is likely to be zero.  (If it isn't zero, the major
version number is greater than 255.x.x -- latest is 3.x.x as I write
this -- so we're probably screwed anyway).  I want to check for the
zero byte in addition to the magic number so as to avoid being
fooled by any stray text earlier in the file.

      if bytes.length < 36 then return
      for i in [0...bytes.length-36]
        if (bytes[i] == 71 and bytes[i+1] == 108 and bytes[i+2] == 117 and
            bytes[i+3] == 108 and bytes[i+4] == 0)
          glulx_start = i
          break
      if not glulx_start? then return

Okay, so at this point bytes[glulx_start] should be the first byte
of the Glulx header and VM address space.  If you want, you can
read the Glulx specification here: http://www.eblong.com/zarf/glulx/

The start of the file is also the start of the virtual machine's
address space, and addresses are in bytes, even if the type being
addressed is larger than one byte, because there are no alignment
requirements.  The basic types we care about are unsigned 8-bit and
32-bit numbers.  8-bit is super easy:

      u8 = (addr) -> bytes[glulx_start + addr]

32-bit unsigned numbers are going to be a bit of a pain because
Javascript bitwise operators return *signed* 32-bit results, but
we can just use addition and multiplication instead I suppose:

      u32 = (addr) ->
        u8(addr)*0x1000000 + u8(addr+1)*0x10000 + u8(addr+2)*0x100 + u8(addr+3)

What's next?  Skipping ahead to section 1.4 of the spec, the header
contains a few useful addresses.  "RAMSTART" is useful because it
marks the end of read-only memory, and there isn't likely to be any
interesting code or data after that point.  "Decoding Tbl" is useful
because we need it to decode compressed strings, and also because,
at least in the files I've looked at (which were presumably generated
by recent versions of the Inform 7 compiler), all of the code seems
to live between the header and the string decoding table, and all
of the actual strings seem to live between the string decoding table
and RAMSTART.  Now of course there's nothing preventing future
versions of Inform or hypothetical other compilers from doing things
differently, but there's also nothing preventing them from (say)
using the setstringtbl opcode, or from obfuscating strings in some
other way, and I'm far too lazy to design this program in such a
way as to make it totally foolproof.  In fact, there is this famous
result in computability theory that... whatever, let's not even go
there, it doesn't matter.  Instead let's do this:

      ram_start = u32 8
      string_table_start = u32 28
      string_table_size = u32 string_table_start
      string_table_end = string_table_start + string_table_size
      huffman_root = u32 string_table_start+8
      code_start = 36
      code_end = string_table_start
      data_start = string_table_end
      data_end = Math.min ram_start, bytes.length-glulx_start

Okay!  Now let's make some string-decoding routines!  Section 1.6.1
lists three kinds of strings: unencoded string, unencoded Unicode
strings, and compressed strings.  Now actually we probably only
really care about compressed strings, as far as I can tell, but the
other two are easy so what the hell.

Let's start with unencoded strings.  These start with 0xe0 followed
by a zero-terminated ISO-8859-1 string, meaning that each unsigned
byte stands for the Unicode code point of the same number.  This
routine takes the address of the string itself (the byte after the
0xe0) as its argument, as well as an explicit callback to which to
send the decoded string, to make it easier to reuse it for the
Huffman decode routine later.

If we can't find the zero terminator, let's just skip invoking the
callback, rather than raising an exception or whatnot, because we
want to try to extract as much as we can.

      decode_u8 = (addr, cb) ->
        chars = []
        loop
          if addr > data_end then return
          byte = u8 addr
          if byte is 0 then return cb chars.join ''
          chars.push String.fromCharCode byte
          addr += 1

Next is unencoded Unicode strings, which I guess are big-endian UTF-32
or whatever.  Same basic idea.  Maybe there's some clever way to combine
these two routines but I'm just going to write it out:

      decode_u32 = (addr, cb) ->
        chars = []
        loop
          if addr > data_end then return
          code_point = u32 addr
          if code_point is 0 then return cb chars.join ''
          chars.push String.fromCharCode code_point
          addr += 4

Now for the interesting part!  Huffman encoded strings... well, the
Glulx spec explains it quite well, actually; there's no need to
even go look at the Wikipedia article on Huffman coding.  Basically
we read the string one bit at a time and use the result to decide
which branch of a binary tree to go down, and the contents of the
next binary tree node tell us what to do next.  I'm going to treat
an unknown node type the same way I treat direct/indirect references:
I'm going to treat them as a hole in the string, basically, meaning
that I'm going to divide the string we're currently decoding into
two halves at that point and attempt to emit both halves.  In
practice this doesn't seem to matter at all; if the current Inform
compiler uses such highfalutin' constructions, I haven't seen them
in the wild.

This routine could proably just use the enclosing routine's cb
unconditionally, because we're not going to reuse decode_huffman
for some other purpose like we're about to with decode_u8 and
decode_u32, but what the hell, may as well try to be consistent,
right?

      decode_huffman = (addr, cb) ->
        pieces = []
        tree_node = huffman_root
        bit_offset = -1
        loop
          bit_offset += 1
          if bit_offset is 8
            bit_offset = 0
            addr += 1
          bit = (u8(addr) >> bit_offset) & 1
          assert u8(tree_node) is 0
          tree_node = u32 tree_node + 1 + 4*bit
          switch u8 tree_node
            when 0 then continue
            when 1 then return cb pieces.join ''
            when 2 then pieces.push String.fromCharCode u8 tree_node+1
            when 3 then decode_u8 tree_node+1, s -> pieces.push s
            when 4 then pieces.push String.fromCharCode u32 tree_node+1
            when 5 then decode_u32 tree_node+1, s -> pieces.push s
            else
              cb pieces.join ''
              pieces = []
          tree_node = huffman_root

Now I think we have all the ingredients we'll need to finally do the
thing!  We're going to loop through every possible u32 in the code area
and try to guess whether it's a pointer to a string.  If it is, we decode
the string.  This ends up emitting strings in the order in which they
appear in the code, which turns out to be a good thing, I think -- I
have seen at least one game in which the strings themselves were alphabetized,
which is not nearly as interesting an order in terms of presenting related
strings together.

It would be easy to deduplicate strings -- we could refuse to decode
the same address twice, or we could do the decoding but deduplicate
the actual contents of the strings.  Again, I feel like this is a
mistake, because the repeated strings often provide valuable clues
about what the heck is going on.  Plus it's slightly easier not to do
those things.  So, we don't.

To be safe, though, let's provide the callback with the address of
each string, as well as the address of the code pointer that pointed
to each string, as additional positional arguments.  Since this is
Javascript, nobody will notice or care if we pass extra arguments
that wind up going unused.  In the weird case where we split a
string into pieces because it contained indirect placeholders, all
of the pieces will have the same addresses, so the caller will have
a clue about what's going on, in case someone cares.

Of course, you'll notice that the routines above only invoke their
callbacks with one argument.  So we'll need a wrapper or something.
And actually this will provide an opportunity to take care of another
niggling issue that's been bothering me: If you've been paying
attention, you'll have noticed that the above routines can invoke
their callbacks with an empty string in a number of corner cases.
That doesn't really seem like a helpful or meaningful thing to do,
so I'm just going to filter those out in the wrapper.  In practice
I'm not sure if it matters either way, but whatever.

      for code_addr in [code_start...code_end]
        data_addr = u32 code_addr
        if not data_start <= data_addr < data_end then continue
        wrapped_cb = (s) -> if s then cb s, data_addr, code_addr
        switch u8 data_addr
          when 0xe0 then decode_u8 data_addr+1, wrapped_cb
          when 0xe1 then decode_huffman data_addr+1, wrapped_cb
          when 0xe2
            if 0 is u8(data_addr+1) is u8(data_addr+2) is u8(data_addr+3)
              decode_u32 data+addr+4, wrapped_cb
      return

And that's our exported function!  If you're building some piece
of software that needs to be able to extract strings from these
types of files, you can stop here.

I want to slap a web UI on top of this at some point, but I'm not
sure whether to put that in this repository or a different one.
Well, no, I can probably sneak it in here, can't I?  Maybe in a
different file, that doesn't necessarily have to go in the npm
module.

But for now I just want a node CLI that I can play with so I can
see if this still works after translating it from the Python.  And
it'll only take a few lines of code, so maybe I can sneak it in
here at the end.  Might remove it later, or not.  You would run
this with `coffee -l`, I suppose.  Hmm, so, how do we check whether
we're being invoked directly as a node.js script, as opposed to
being required by someone else's script?  Right:

    if module? and module is require?.main
      fs = require 'fs'
      bytes = fs.readFileSync process.argv[2]
      exports.extract_strings bytes, (s) -> console.log s

## License

Copyright (c) 2015 Jacques Frechet

### The MIT License (MIT)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
