# glulx-strings

extract raw text fragments from interactive fiction glulx gblorb Inform

## wtf is this thing?!  Plz expln plz!

Okay, so, maybe you've written a shiny new text adventure game in
Inform 7 and sent the `.gblorb` out to your testers and then
accidentally drop your computer over the side of your boat and the
backups are a lie and you don't care that much about the game logic
but you really want to get all that prose back.  Or maybe you
stumbled across an obscure work of interactive fiction and you've
gotten really invested but you got stuck halfway through and you've
been banging your head against it for weeks but there are no hints
or they aren't doing it for you and you've broken down and searched
everywhere for a walkthrough or a forum thread, anything, nope,
crickets.

Anyway this thing takes the contents of a `.gblorb` file (containing
a Glulx game -- doesn't support Z-machine, sorry) and extracts the
text.  Typically this includes all of the text visible in the game.
It may also include various internal identifiers that might or might
not actually be theoretically reachable but are nonetheless in there
so the game can try to emit helpful diagnostics in case it finds
itself in an unexpected situation and does not know how else to
proceed.

[I feel like an example would be helpful.  Maybe I can come up with
one later and stick it here.]

You would think this would be super easy -- I mean normally when
you have a computer program in some non-human-readable form and you
want to see the text it contains, you can run something like the
`strings` Unix command on it, which mostly just looks through the
file for any sequence of 4 or more consecutive printable ASCII
characters and shows you those, which is surprisingly effective.
But for Glulx (and Z-code) this tends not to work, because the text
is usually compressed, using a Huffman encoding scheme.  I guess
back in the Infocom days it was important to do this in order to
be able to fit more game on a floppy disk, and I assume that the
practice has persisted because there was no compelling reason to
stop doing it and also because it makes it that much harder to
cheat.  [Erm.  Sorry about that.]

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
you even care, which you probably don't that much really.  Though,
if you do, by all means read on, because I'm going to talk about
it in more detail below.

For now, I've posted my initial Python implementation, but it
occurred to me that it would be way better to do this in Javascript,
because I am assuming that you are probably a human being and most
human beings do not know off the top of their heads how to run a
Python program and get it to do something useful, and those who do
have some idea of what's involved often have better things to do
with their time, whereas if this thing is Javascript it can live
on a web page and you can just drag the file onto the page and it
can show you the text, bam, done.

So I'm working on that.  Of course I'm not going to be writing any
Javascript by hand, I mean that would be crazy.  I'll be using
CoffeeScript instead: http://coffeescript.org/

(Note that, as of this writing, the Python version works but the
Javascript/CoffeeScript version doesn't.  At least, it doesn't seem
to.)

## Let's see here.

So actually I think I can just write the code right in here, right?
And then `coffee -cl` will extract the code bits and compile them
and it'll all be good.  Probably!

Let us begin.

I want this to be a module exporting a function that takes, uh, a
buffer-like thing, file contents, array of unsigned bytes, and...
let's make it asynchronous, so it repeatedly invokes a callback
with one string each time, and then returns.  Not that that's really
asynchronous, exactly, but it's... incremental?  The caller knows
it's got the last string when the function has returned.  The
callback won't get invoked again later.  It's purely synchronous,
really, but you might not have to wait as long before you start
getting strings back.

Let's call this function, uh, `extract_strings`.

    exports.extract_strings = (bytes, cb) ->

Okay, so, first thing we need to do is... I'm assuming most people
are going to want to pass in a `.gblorb`, because most games come
packaged that way... er, most IF games written with Inform 7, I
should say?  As opposed to a plain Glulx file, is what I mean.  So
we first need to find the Glulx.  And so a `.gblorb` is some kind
of IFF file and we could parse it and find the right chunk, or we
could just say screw that and look for the Glulx header, and that
way this'll work even if it's just a plain Glulx file, or some other
kind of file with a `.gblorb` and/or Glulx embedded in it, so long
as it's not like compressed or encoded in some other fancy way.

If you want, you can read the Glulx specification here:
http://www.eblong.com/zarf/glulx/

The Glulx header is 36 bytes long and starts with the 4-byte sequence
`Glul` (the "magic number") followed by a big-endian version number
whose first byte is likely to be zero.  (If it isn't zero, the major
version number is greater than 255.x.x -- latest is 3.x.x as I write
this -- and major version bumps are likely to break things, so we're
probably screwed anyway).  I want to check for the zero byte in
addition to the magic number so as to avoid being fooled too easily
by any stray text earlier in whatever file the user happened to
hand us.

      header_size = 36
      if bytes.length < header_size then return
      for i in [0...bytes.length-header_size]
        if (bytes[i] == 71 and bytes[i+1] == 108 and bytes[i+2] == 117 and
            bytes[i+3] == 108 and bytes[i+4] == 0)
          glulx_start = i
          break
      if not glulx_start? then return

Okay, so at this point bytes[glulx_start] should be the first byte
of the Glulx header and VM address space.  Pointer addresses are
always in bytes, even if the type being addressed is larger than
one byte, because there are no alignment requirements.  The basic
types we care about are unsigned 8-bit and 32-bit numbers.  8-bit
is super easy:

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
using the `setstringtbl` opcode, or from obfuscating strings in
some other way, and I'm far too lazy to design this program in such
a way as to make it totally foolproof.  In fact, there is this
famous result in computability theory that... whatever, let's not
even go there, it doesn't matter.  Instead let's do this:

      ram_start = u32 8
      string_table_start = u32 28
      string_table_size = u32 string_table_start
      string_table_end = string_table_start + string_table_size
      huffman_root = u32 string_table_start+8
      code_start = header_size
      code_end = string_table_start
      data_start = string_table_end
      data_end = ram_start

Okay!  Now let's make some string-decoding routines!  Section 1.6.1
lists three kinds of strings: unencoded string, unencoded Unicode
strings, and compressed strings.  Now actually we probably only
really care about compressed strings, as far as I can tell, but the
other two are easy so what the hell.

Let's start with unencoded strings.  These start with 0xe0 followed
by a NUL-terminated ISO-8859-1 string, meaning that each unsigned
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

Next is unencoded Unicode strings, which I guess are big-endian
UTF-32 or whatever.  Same basic idea.  Maybe there's some clever
way to combine these two routines but I'm just going to write it
out:

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
I'm going to treat each of those things as a hole in the string,
basically, meaning that I'm going to divide the string we're currently
decoding into two halves at that point and attempt to emit both
halves.  In practice this doesn't seem to come up at all; if the
current Inform compiler uses such highfalutin' constructions, I
haven't seen them in the wild yet.  Though I haven't looked very
hard.

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

Hmm, I think that assertion I stuck in there is only guaranteed to
hold if we first ensure that the Huffman table is non-trivial.  But
actually there are lots of ways the whole thing could blow up if
we get a valid-looking Glulx file that happens to have an invalid
Huffman table.  I'm not going to stress about that too much right
now -- ultimately I doubt the caller's going to care all that much
about the subtle distinction between returning and raising an
exception.  For the record, any exception thrown (array index out
of bounds, assertion failure, or the like) means that the file
looked valid at first but is actually corrupt!  Or that my code is
buggy, of course, but I mean that goes without saying.

Oh, but I should probably at least pull in the `assert` module
before trying to use it, right?  Damn.  Well, it's not too late,
we haven't called `decode_huffman` yet, so I'll just do it now:

      assert = require 'assert'

Wish I'd thought of that earlier.  Ah well.

Now I think we have all the ingredients we'll need to finally do
the thing!  We're going to loop through every possible u32 in the
code area and see whether it points to something that might be a
string.  If so, we'll try to decode the string using the appropriate
routine defined above.  This ends up emitting strings in the order
in which they appear in the code, which turns out to be a good
thing, I think -- I have seen at least one file in which the strings
themselves were alphabetized, which is not nearly as interesting
an order in terms of presenting related strings together.  Whereas
going in code order tends to show strings that get used together
as part of the same larger message in their proper order, and tends
to group thematically related strings together.

It would be easy to deduplicate strings -- we could refuse to decode
the same address twice, or we could do the decoding but deduplicate
the actual contents of the strings.  Again, I feel like either kind
of deduplication would be a mistake, because the repeated strings
often provide valuable clues about what the heck is going on.  Plus
it's slightly easier not to deduplicate.  So, we don't.

To be safe, though, let's provide the callback with the address of
each string, as well as the address of the code pointer that pointed
to each string, as additional positional arguments, so the caller
can deduplicate or reorder if they really want to.  Since this is
Javascript, nobody will notice or care if we pass extra arguments
that wind up going unused.  In the weird case where we split a
string into pieces because it contained indirect placeholders, all
of the pieces will have the same code and data addresses, so the
caller will have a clue about what's going on, in case someone
cares.

Of course, you'll have noticed that the routines above only invoke
their callbacks with one argument.  So we'll need a wrapper or
something.  And actually this will provide an opportunity to take
care of another niggling issue that's been bothering me: You will
also have noticed that the above routines can invoke their callbacks
with an empty string in a few corner cases.  That doesn't really
ever seem like a helpful or meaningful thing to do, so I'm just
going to filter those out in the wrapper.  In practice I'm not sure
if it matters either way, since I bet those corner cases don't come
up, but whatever.

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
this as `coffee -l README.md foo.gblorb`, I suppose.  Hmm, so, how
do we check whether we're being invoked directly as a node.js script,
as opposed to being `require`d by someone else's script?  Right:

    if module? and module is require?.main
      fs = require 'fs'
      bytes = fs.readFileSync process.argv[2]
      exports.extract_strings bytes, (s) -> console.log s

Hmm, why isn't this working?  Damn it....

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
