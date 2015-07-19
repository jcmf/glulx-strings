# glulx-strings

extract raw text fragments from interactive fiction glulx gblorb Inform

## What is this thing?!

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

Anyway this thing takes the contents of a file containing a Glulx
or Z-code game and extracts the text.  Typically this includes all
of the text visible in the game.  It may also include various
internal identifiers that might or might not actually be theoretically
reachable but are nonetheless in there so the game can try to emit
helpful diagnostics in case it finds itself in an unexpected situation
and does not know how else to proceed.

Currently supported file formats include Glulx, Z-code versions 3
(`.z3`) through 8 (`.z8`), TADS 2 (`.gam`), TADS 3 (`.t3`), blorb
files containing any of the above (`.gblorb`, `.zblorb`, etc), or
`.zip` files containing any of those things.

[Try it now.](http://toastball.net/glulx-strings/)

[I feel like an example would be helpful, for those of us who do
not have a suitable input file lying around.  Maybe I can come up
with one later and stick it here.]

You would think it would be super easy to do this without a special
tool -- I mean normally when you have a computer program in some
non-human-readable form and you want to see the text it contains,
you can run something like the Unix `strings` command on it, which
mostly just looks through the file for any sequence of 4 or more
consecutive printable ASCII characters and shows you those.  But
for Glulx (and Z-code) this tends not to work, because the text is
usually compressed.  I guess back in the Infocom days it was important
to compress in order to be able to fit more game on a floppy disk,
and I assume that the practice has persisted in Glulx because it
makes it that much harder to cheat.  [Erm.  Sorry about that.]

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
it in more detail below.  If you care about how the noise reduction
heuristics work, I mean.  If all you care about is that there is
less noise than there would have been otherwise, you don't need to
read anything, it just works.  I mean it's not perfect, there's
still some noise.

My first few drafts of this idea were in Python (and you can still
find a working version here, in `glulx-strings.py`), but it occurred
to me that it would be way better to do this in Javascript, because
I am assuming that you are probably a human being and most human
beings do not know off the top of their heads how to run a Python
program and get it to do something useful, and those who do have
some idea of what's involved often have better things to do with
their time, whereas if this thing is Javascript it can live on a
web page and you can just drag the file onto the page and it can
show you the text, bam, done.

And as of this writing, that actually seems to be working.

The source code for the core Javascript library is in this file,
oddly enough.  I'm thinking that I should move it to a separate
file, though, so I can show example output above in a code block
without CoffeeScript trying to compile it.

The source for the HTML UI already lives over in `index.jade`, which
is compiled with `gribbl`, which I created in order to do exactly
that task for exactly this project, though I'm hoping to use it for
other things too.

## Source code

So actually I think I can just write the code right in here, right?
And then `coffee -cl` will extract the code bits and compile them
and it'll all be good.  Probably!

Let us begin.

### Glulx

Let's start with a thing that can tell us whether a file is even a
Glulx file.  If you want, you can read the [Glulx
specification](http://www.eblong.com/zarf/glulx/).

The Glulx header is 36 bytes long and starts with the 4-byte sequence
`Glul` (the "magic number") followed by a big-endian version number
whose first byte is likely to be zero.  (If it isn't zero, the major
version number is greater than 255.x.x -- latest is 3.1.2 as I write
this -- and major version bumps are likely to break things, so we're
probably screwed anyway).  I want to check for the zero byte in
addition to the magic number so as to avoid being fooled too easily
by stray text.

    exports.is_glulx = (bytes) ->
      bytes.length > 36 and bytes[0] is 71 and bytes[1] is 108 and
          bytes[2] is 117 and bytes[3] is 108 and bytes[4] is 0

Here, `bytes` is the file contents represented as a `Buffer`-like
thing, which is to say an array of unsigned bytes.

Now to actually extract strings from Glulx code!  What we need is
a function that takes a buffer and and... let's make it asynchronous,
so it repeatedly invokes a callback with one string each time, and
then returns.  Not that that's really asynchronous, exactly, but
it's... incremental?  The caller knows it's got the last string
when the function has returned.  The callback won't get invoked
again later.  It's purely synchronous, really, but you might not
have to wait as long before you start getting strings back.

Let's call this function, uh, `extract_glulx_strings`.

    exports.extract_glulx_strings = (bytes, cb) ->

This used to do a slow linear search for the Glulx magic, but I've
since added proper blorb support, and as of version 4 this function
no longer works on `.gblorb` files.  You probably wanted the
`extract_strings` function anyway.  It has the same signature as
this function, but works on any supported file format, including
`.gblorb`.

First check to see if this file is Glulx; if it isn't, return without
invoking the callback, to indicate that we couldn't extract any
strings.

      if not exports.is_glulx bytes then return

Okay, so at this point `bytes[0]` should be the first byte of the
Glulx header and VM address space.  Pointer addresses are always
in bytes, even if the type being addressed is larger than one byte,
because there are no alignment requirements.  The basic types we
care about are unsigned 8-bit and 32-bit numbers.  8-bit is trivial:

      u8 = (addr) -> bytes[addr]

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
      header_size = 36
      code_start = header_size
      code_end = string_table_start
      data_start = string_table_end
      data_end = ram_start

Okay!  Now let's make some string-decoding routines!  Section 1.6.1
lists three kinds of strings: unencoded strings, unencoded Unicode
strings, and compressed strings.  Now actually we probably only
really care about compressed strings, as far as I can tell, but the
other two look easy so what the hell.

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

This routine could proably just use the enclosing routine's `cb`
unconditionally, because we're not going to reuse `decode_huffman`
for some other purpose like we're about to with `decode_u8` and
`decode_u32`, but what the hell, may as well try to be consistent,
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
hold if we first ensure that the Huffman table is non-trivial.  And
actually there are lots of ways the whole thing could blow up if
we get a valid-looking Glulx file that happens to have an invalid
Huffman table.  Maybe it would be best to validate the whole tree
up front?  I'm not going to stress about that too much right now,
but I might want to come back to this, because it occurs to me that,
with no bounds checking in this code, we could easily end up trying
to loop forever.  I would rather assert or raise an exception.

Oh, but I should probably at least pull in the `assert` module
before trying to use it, right?  Damn.  Well, it's not too late,
we haven't called `decode_huffman` yet, so I'll just do it now:

      assert = require 'assert'

Wish I'd thought of that earlier.  Ah well.  Maybe I can move it
up later.  I'll have to clean up all this text, too.

Now I think we have all the ingredients we'll need to finally do
the thing!  We're going to loop through every possible `u32` in the
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
compressed string into pieces because it contained wacky placeholders,
all of the pieces will have the same code and data addresses, so
the caller will have a clue about what's going on, in case someone
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
up in any of the real files I'm likely to try, but whatever.

      for code_addr in [code_start...code_end]
        data_addr = u32 code_addr
        unless data_start <= data_addr < data_end then continue
        wrapped_cb = (s) -> if s then cb s, data_addr, code_addr
        switch u8 data_addr
          when 0xe0 then decode_u8 data_addr+1, wrapped_cb
          when 0xe1 then decode_huffman data_addr+1, wrapped_cb
          when 0xe2
            if 0 is u8(data_addr+1) is u8(data_addr+2) is u8(data_addr+3)
              decode_u32 data_addr+4, wrapped_cb
      return

The `return` at the end is there to talk CoffeeScript out of helpfully
building up an array of all the accumulated callback return values
and returning it.

### Z-code

Gosh, now I kinda want to see if I can make this work for Z-code.
Let's have a look at the [Z-machine
specification](http://inform-fiction.org/zmachine/standards/z1point1/index.html)...
wow, this looks intimidating.  Makes you appreciate Glulx more,
doesn't it?

First off, can I even identify a file with Z-code in it?  Section
11 and Appendix B offer some clues, but this looks pretty thin.

Golly, it looks like the `file` command on my Mac can identify these
`.z8` files, no problem.  Let me see what it's doing... yeah, okay,
it's ignoring the first 16 bytes and looking at the next four bytes.
Or three out of four.  Certain bits thereof.  Gosh.  Okay.

You know what, I'm going to further restrict this by the version
number in the first byte.  Supposedly files older than version 3
are quite rare, and the strings are encoded in a slightly different
way, and I don't want to deal with that, surely?  Maybe I'll come
back and add support for versions 1 and 2 later.  I guess it's not
impossible that it'll happen.

    exports.is_zcode = (bytes) ->
      bytes.length >= 0x40 and bytes[0] >= 3 and
          (bytes[0x10] & 0xfe) is 0 and
          (bytes[0x12] & 0xf0) is (bytes[0x13] & 0xf0) is 0x30

Okay, now let's see if we can extract some strings.  First we check
the header, and look up the version number and the location of the
abbreviations table.

The Z-machine expresses most addresses in bytes (though not all),
so I'm just going to define a `u16` that takes a byte address and
use that everywhere.  I won't bother to define a `u8`; we can just
use `bytes[addr]` for that.

    exports.extract_zcode_strings = (bytes, cb) ->
      if not exports.is_zcode bytes then return
      u16 = (addr) -> bytes[addr]<<8 | bytes[addr+1]
      version = bytes[0]
      abbrev_addr = u16 0x18

Speaking of other address formats, there's a version-dependent
notion of a "packed address" for a string.  The next routine turns
a packed string address into a byte offset.  If we don't recognize
the file version, let's just always return an invalid address, so
we'd just quietly fail to decode any packed string addresses while
retaining the ability to decode other kinds of strings.  I mean I'm
kinda hoping that there will never need to be a version 9, because
that's kinda what Glulx already is, but who knows, right?

      unpack_addr = switch version
        when 1, 2, 3 then (packed_addr) -> 2*packed_addr
        when 4, 5 then (packed_addr) -> 4*packed_addr
        when 6, 7 then do ->
          S_O = 8*u16 0x2a
          (packed_addr) -> 4*packed_addr + S_O
        when 8 then (packed_addr) -> 8*packed_addr
        else -> bytes.length

The structure of the object table is similarly version-dependent.
This is useful because there's an instruction that prints object
names.

      objname_addr = do ->
        [offset, stride] = if version < 4 then [2*31, 9] else [2*63, 14]
        offset += stride-2 + u16 0x0a
        (obj_num) -> u16 obj_num*stride + offset

Initialize the alphabet and Unicode tables.  The story file is
supposed to be able to override these, but maybe I'll worry about
that later.

The `x` at the start of `a2` is a placeholder for an escape sequence
that can't be overridden.  The newline following it is literal, but
we aren't supposed to let story files override that one either.

      a0 = 'abcdefghijklmnopqrstuvwxyz'
      a1 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      a2 = 'x\n0123456789.,!?_#\'"/\\-:()'
      unicode_table = [
        0x0e4, 0x0f6, 0x0fc, 0x0c4, 0x0d6, 0x0dc, 0x0df, 0x0bb,
        0x0ab, 0x0eb, 0x0ef, 0x0ff, 0x0cb, 0x0cf, 0x0e1, 0x0e9,
        0x0ed, 0x0f3, 0x0fa, 0x0fd, 0x0c1, 0x0c9, 0x0cd, 0x0d3,
        0x0da, 0x0dd, 0x0e0, 0x0e8, 0x0ec, 0x0f2, 0x0f9, 0x0c0,
        0x0c8, 0x0cc, 0x0d2, 0x0d9, 0x0e2, 0x0ea, 0x0ee, 0x0f4,
        0x0fb, 0x0c2, 0x0ca, 0x0ce, 0x0d4, 0x0db, 0x0e5, 0x0c5,
        0x0f8, 0x0d8, 0x0e3, 0x0f1, 0x0f5, 0x0c3, 0x0d1, 0x0d5,
        0x0e6, 0x0c6, 0x0e7, 0x0c7, 0x0fe, 0x0f0, 0x0de, 0x0d0,
        0x0a3, 0x153, 0x152, 0x0a1, 0x0bf
      ]

Now we can make a routine that decodes a string at a given byte
address and returns it, or returns null if we can somehow tell that
there's no valid string starting at that address.  I guess I'll try
to be a bit strict about it, because the clues for where to find
strings seem a bit less reliable than they did for Glulx.

You can read about the gory details in section 3 of the spec, but
the basic idea here is that every string is always represented as
a sequence of 16-bit words.  Each such word contains three 5-bit
values representing characters and/or fancy escape sequences, plus
one bit indicating end-of-string.  Some of the codes are "shifts"
affecting how the next code is interpreted (e.g. uppercase), that
are also used to harmlessly pad out the end of a string whose length
isn't a multiple of three or whatever.  There are also ways to refer
to the "Unicode table" and the "abbrevation table" mentioned above.

The `no_abbrev` flag is there to help us avoid accidentally recursively
expanding abbreviations forever.

      decode_string = (addr, no_abbrev) ->
        a = a0
        abbrev = tenbit = null
        pieces = []
        loop
          if addr + 1 >= bytes.length then return
          v = u16 addr
          addr += 2
          for shift in [10, 5, 0]
            z = (v >> shift) & 0x1f
            if abbrev
              aa = 2 * u16 abbrev_addr + 2*(32*(abbrev-1) + z)
              piece = decode_string aa, true
              abbrev = null
              if not piece then return
              pieces.push piece
            else if tenbit
              tenbit.push z
              if tenbit.length < 2 then continue
              zscii = tenbit[0]<<5 | tenbit[1]
              tenbit = null
              if zscii >= 252 then return
              else if 155 <= zscii < 155+unicode_table.length
                pieces.push String.fromCharCode unicode_table[zscii - 155]
              else pieces.push switch zscii
                when 11 then '  '
                when 13 then '\n'
                else String.fromCharCode zscii
            else if z is 0
              pieces.push ' '
              a = a0
            else if z in [1..3]
              if no_abbrev then return
              abbrev = z
            else if z is 4 then a = a1
            else if z is 5 then a = a2
            else if z is 6 and a is a2
              tenbit = []
              a = a0
            else
              pieces.push a[z-6]
              a = a0
          if v >> 15 then return pieces.join ''

Wow, this spec is confusing.

* What's with the abbreviation table address in the header being a
byte address?  Is it allowed to be odd?

* It isn't clear to me what's supposed to happen if an abbrevation
immediately follows a shift.  Do we apply the shift to the first
letter of the abbreviation?  Do we shift the first letter following
the abbreviation?  Do we do neither of those things?  Is there some
other even more frightening possibility I haven't even considered?

* The format of the abbreviation table is unclear -- what's with
"abbreviation strings" vs "abbreviation table" in the example memory
map at the end of section 1?  Maybe there's supposed to be a table
length in there or something, rather than just lauching straight
in to the list of pointers?  If so, is this described somewhere?
Where?

Okay, so!  How do we find strings?  The more I think about this,
the more it seems like we're going to have to look for byte patterns
that could be instructions that print strings.  I guess we can just
scan the entire address space?

      for code_addr in [0...bytes.length]
        data_addr = switch bytes[code_addr]
          when 135 then u16 code_addr+1  # print_addr
          when 138 then objname_addr u16 code_addr+1  # print_obj
          when 141 then unpack_addr u16 code_addr+1  # print_paddr
          when 178, 179 then code_addr+1  # print, print_ret
        if data_addr and s = decode_string data_addr
          cb s, data_addr, code_addr
      return

That actually seems to be doing something plausible!  I mean I
haven't looked very carefully.  Maybe only one or two of the above
opcodes is working right, and the rest are broken.  Or maybe there's
some other thing entirely that I should be doing in order to get
better coverage, like trying to walk the object table up front, or
looking for other places that might point to strings in trickier
ways, or something.

Like, looking at Endless, Nameless, highlighted words often seem
to be missing, at least in context.  Maybe because they're subroutines?
I'm almost tempted to try to detect and inline those somehow.  But
that way lies madness, surely -- the whole point of this exercise
was to avoid writing a full disassembler....

### Blorb

It turns out that Z-code can come in Blorb files too, and the method
I was using to find Glulx in a `.gblorb` was ugly and slow and
didn't generalize super well, so let's make a thing that can extract
useful information from blorb files.  I actualy found an npm module
that claims to do this, but it looks like it absolutely wants to
do its own file I/O, rather than letting me pass in a byte buffer,
boooo.  Also it looks super complicated.  Surely we can do better?
For certain highly specialized values of "better"?

At some point it might be cool to be able to extract images as well
as text.  Let's maybe lay the groundwork for that now.

We'll need to consult the [Blorb
spec](http://www.eblong.com/zarf/blorb/blorb.txt) and the [IFF
spec](http://www.martinreddy.net/gfx/2d/IFF.txt).  Actually I'm
finding all of this pretty difficult to understand, but looking
back and forth between the Blorb spec and the first few bytes of
an actual `.zblorb` file is helping me put things in the right
context, I hope.

First a thing that can tell us if we're even looking at a blorb
file at all.  Looks like 12 of the first 16 bytes are fixed, which
should be plenty.

    exports.is_blorb = (bytes) ->
      magic = 'FORM....IFRSRIdx'
      if bytes.length < magic.length then return false
      for ch, i in magic
        if ch is '.' then continue
        if bytes[i] != ch.charCodeAt 0 then return false
      return true

Next I think what we want is a routine that takes a blorb and maybe
some optional arguments describing which resources we might be
interested in, and invokes a callback (synchronously, before
returning) for each matching resource it finds.

    exports.unblorb = (bytes, opts, cb) ->

I want to be able to pass the buffer or the callback in as named
options instead of as positional arguments.  Basically all of the
arguments are optional, they just aren't all optional at once....

      if bytes.bytes or bytes.buffer
        [bytes, opts, cb] = [bytes.bytes or bytes.buffer, bytes, opts]
      cb or= opts.cb or opts.callback or opts

I'm running into trouble a bit later on trying to get this to work
in a browser.  Aren't typed arrays supposed to have `slice`?  Maybe
I can get Browserify's Buffer shim to help me out here?  Yes, this
totally seems to fix the problem:

      if not bytes.slice then bytes = new Buffer bytes

Make sure this is a blorb.

      if not exports.is_blorb opts.bytes then return

There are going to be some big-endian 32-bit integers in here.  IFF
spec makes it sound like they're signed but I'm going to ignore
that and pretend they're unsigned, even though signed would be a
bit easier because I could use Javascript bitwise operators, but
whatever, this isn't hard:

      u32 = (addr) -> (bytes[addr]*0x1000000 + bytes[addr+1]*0x10000 +
        bytes[addr+2]*0x100 + bytes[addr+3])

IFF also likes to have four-byte IDs that are really ASCII strings.

      id = (addr) ->
        (String.fromCharCode(bytes[addr + i]) for i in [0..3]).join ''

Go through the resource table.  It has both a number of bytes and a number
of 12-byte entries; let's use whichever is effectively smaller.

      offset = 24
      stride = 12
      count =
        Math.min u32(20), Math.min(u32(16)-4, bytes.length-offset) // stride
      for i in [0...count]
        entry = offset + stride*i
        usage = id entry
        number = u32 entry+4
        chunk_start = u32 entry+8

Figure out resource type and size.  Quietly ignore it if it's out of bounds.

        if not chunk_start then continue
        res_start = chunk_start + 8
        if res_start > bytes.length then continue
        type = id chunk_start
        res_size = u32 chunk_start+4
        res_end = res_start + res_size
        if res_end > bytes.length then continue

If the caller asked for a particular resource usage, number, or
type, filter out non-matching entries.  Otherwise, invoke the
callback.

        if opts.usage and opts.usage != usage then continue
        if opts.number? and opts.number != number then continue
        if opts.type and opts.type != type then continue
        cb {usage, number, type, bytes: bytes[res_start...res_end]}
      return

### TADS 3

Can we do TADS?  I just ran across a TADS 3 game and I tried running
`strings` on it and the results were disappointing.

Aha, yes, check out the [T3 VM Image File Format
spec](http://www.tads.org/t3doc/doc/techman/t3spec/format.htm).
There's an "xor mask."

All right, let's do this.  You know the drill.

    exports.is_t3 = (bytes) ->
      magic = 'T3-image\x0d\x0a\x1a'
      if bytes.length < magic.length then return false
      for ch, i in magic
        if bytes[i] != ch.charCodeAt 0 then return false
      return true

Okay, that was the thing, so next we need to do the thing.  I'm
assuming that the only thing we care about is the constant data
pool pages?  I do see an opcode that prints an inline string, but
the claim is that it's the only such thing and that it's mainly
used for debugging, or something, so right now I don't want to
bother.

Let's just, uh, dump anything that appears in a constant data pool
and looks like moderately well-formed UTF-8.  Break on NULs and
control characters, on the theory that those aren't likely to appear
in strings and if they do who cares.  I mean probably there are
newlines but we can split on newlines, nobody is going to be upset
if we do that, surely.

Going to lean on the Buffer constructor to do the UTF-8 decode for
us.  It looks like it quietly replaces invalid sequences with code
point 0xfffd, good old REPLACEMENT CHARACTER, the little question
mark in a diamond that shows up when something went wrong, so I'll
just, uh, split on those too, I guess?  I stuck a try in there just
in case it occasionally decides to be less quiet, because the API
docs I'm looking at seem suspiciously thin and I'm feeling paranoid.

Maybe in some later version I can scan bytecode for string start
addresses and use that to help disambiguate?  I wonder if that would
even produce noticeably better results.  Maybe.  It does seem like
at least some of these strings are just shoehorned together with
no separator.  Lengths must be elsewhere.

    exports.extract_t3_strings = (bytes, cb) ->
      if not exports.is_t3 bytes then return
      for i in [0...bytes.length - 17]
        if bytes[i+0] != 67 then continue  # C
        if bytes[i+1] != 80 then continue  # P
        if bytes[i+2] != 80 then continue  # P
        if bytes[i+3] != 71 then continue  # G
        block_start = i + 10
        block_size = (bytes[i+4] + 0x100*bytes[i+5] + 0x10000*bytes[i+6] +
            0x1000000*bytes[i+7])
        if block_size <= 7 then continue
        if block_start + block_size > bytes.length then continue
        pool_id = bytes[block_start] | bytes[block_start+1]<<8
        if pool_id != 2 then continue
        xor_mask = bytes[block_start + 6]
        data_start = block_start + 7
        data_end = block_start + block_size
        encoded = []
        for j in [data_start...data_end]
          b = bytes[j] ^ xor_mask
          if b >= 32
            encoded.push b
            continue
          if not encoded.length then continue
          data_addr = j - encoded.length
          decoded = try new Buffer(encoded).toString()
          encoded = []
          if not decoded then continue
          for s in decoded.split '\ufffd'
            if s then cb s, data_addr
      return

Okay, yeah, that last part where I use the same `data_addr` for all
the pieces after splitting on decode errors seems a bit unfortunate.
I guess it wouldn't be that hard to just do the UTF-8 decode by
hand, so we could keep closer track of what came from where.
Especially if... am I reading this right, that this thing doesn't
believe in >16-bit code points?  I understand that people were
somehow able to fool themselves fifteen years ago, but... or is
this a Windows thing maybe?  Funny how there are stll all these
pockets of 16-bit Unicode frozen in time.  All from a certain era,
I guess.  Anyway maybe I should just expect it to be UTF-8 with
like surrogates in it.  Ew, no, I refuse to assume that.  How hard
could it be to just decode proper UTF-8?  Will whatever's rendering
the glyphs quietly deal with any surrogates that might crop up, or
will I be expected to normalize?

### TADS 2

Oops, here's a TADS 2 `.gam` file.  Doesn't seem to work.  `strings`
doesn't like it.  Completely different format, apparently.  I haven't
been able to find documentation for the file format, but this
[Jetty](http://inky.org/if/jetty/) thing has source code.  I'm
mostly interested in `GameFileParser.java`.

I should probably just make a general-purpose function that checks whether
a thing starts with a certain byte sequence.

    exports.is_tads2 = (bytes) ->
      magic = 'TADS2 bin\x0a\x0d\x1a\x00'
      if bytes.length < magic.length then return false
      for ch, i in magic
        if bytes[i] != ch.charCodeAt 0 then return false
      return true

    exports.extract_tads2_strings = (bytes, cb) ->
      if not exports.is_tads2 bytes then return

So let's see.  Looks like we're going to want to read through this
in order, mostly?  Sometimes from `bytes`, and sometimes from
decrypted buffers that we extracted from inside it.  I'll define
decryption later.  First, let's make a thing to keep track of our
current position and extract unsigned little-endian numbers while
advancing that position.  I see something about the 32-bit thing
being signed but that seems dumb and is inconvenient for me because
it complicates my bounds-checking, so I'll pretend it's unsigned,
as usual.

      class Stream
        constructor: (@buf, @base = 0, @pos = 0, @end = @buf.length) ->
        len: -> @end - @pos
        eof: -> not @len() > 0  # true if @len() becomes NaN!
        skip: (len) -> @pos += len
        seek: (addr) -> @pos = addr - @base
        tell: -> @base + @pos
        u8: -> if @eof() then throw new Error 'eof' else @buf[@pos++]
        u16: -> @u8() + 0x100*@u8()
        u32: -> @u16() + 0x10000*@u16()
        copy: (len = @len()) ->
          if len > @len() then len = @len
          new Stream @buf, @base, @pos, @pos += len
        bytes: (len = @len()) -> (@u8() for i in [0...len] when not @eof())

And I guess strings are encoded in... whatever Java's default
platform encoding might typically have been in 2002?  Let's go with
ISO Latin 1, I guess?  I hope we don't need CP1252 for this.

        str: (len) ->
          (String.fromCharCode byte for byte in @bytes len).join ''
        extract: (len) ->
          data_addr = @tell()
          s = @str len
          if s then cb s, data_addr

We're going to need to be able to skip over some NUL-terminated
strings, I guess?  Let's make things to skip past a particular
byte and/or extract the string in between.

        skip_past: (byte) ->
          while @u8() != byte
            if @eof() then return
          return
        extract_to: (byte) ->
          start = @pos
          @skip_past byte
          len = @pos - 1 - start
          @pos = start
          @extract len
          @skip 1

Make a Stream representing the whole input file:

      stream = new Stream bytes

And use it to extract the magic number, and the version.  Because
I just decided that those are kinda like strings and we may as well
show them.

      stream.extract_to 0x0a
      stream.skip_past 0
      stream.extract_to 0

Now some flags.  If this bit is set (and apparently it almost always
is?), we need to enable "decryption."  Or "encryption," same thing,
it's symmetric that way.

      decrypt = if stream.u16() & 8 is 0
        (buf) -> buf
      else
        xor_seed = 63
        xor_inc = 64
        decrypt = (bytes) ->
          xor_value = xor_seed
          for byte in bytes
            byte ^= xor_value
            xor_value += xor_inc
            xor_value &= 0xff
            byte

Timestamp is a string?  Extract it!

      stream.extract_to 0

Okay, now we read various named blocks and do exciting things with
them.

      loop
        name = stream.str stream.u8()
        next_pos = stream.u32()
        block = stream.copy next_pos - stream.tell()
        if block.eof() then return
        switch name
          when '$EOF' then return
          when 'XSI'
            xor_seed = block.u8()
            xor_inc = block.u8()
          when 'OBJ' then while not block.eof()
            type = block.u8()
            id = block.u16()
            switch type

Object types 1 and 2 are functions and, uh, objects.  Both start
out similarly: there's a length, there's ... another copy of the
same length, for some reason?  Jetty ignores the first one, so let's
just do that.  And then the given number of "encrypted" bytes.

              when 1, 2 then do ->
                block.skip 2
                len = block.u16()
                addr = block.tell()
                buf = decrypt block.bytes len

And now we can extract strings!  Could just scan for ASCII at this
point, or we could do a full parse, or... gosh, whate are we even
looking for in here?

Looks like strings can appear in bytecode (after the OPCSAY (29)
or OPCPUSHSTR (31) opcode, either of which can appear in a function
object or a CODE object, the latter of which can be a LIST element),
or in a SSTRING (3) or DSTRING (9) property, or in a LIST with an
SSTRING element.

In all of these cases, the actual string is immediately preceded
by a u16 length.  The opcodes and the SSTRING list element have the
opcode or type byte right before the length, making identification
easy.  The SSTRING or DSTRING properties have a (useless?) flag
byte before the length, and another u16 length before that (which
will be two more than the actual string length, because it excludes
the flag byte but includes the other length bytes), and then the
type byte before *that*.  Which is an even *more* distinctive
pattern.

So I'm going to blindly scan for some lazy superset of the above
patterns, and then throw out the ones that have unlikely-looking
control characters in them, to weed out almost all of the false
positives.

                for byte, pos in buf
                  if byte not in [3, 9, 29, 31] then continue
                  data_start = pos + 3
                  data_len = buf[pos+1] + 0x100*buf[pos+2] - 2
                  data_end = data_start + data_len
                  if (data_len >= 2 and
                      data_end+1 <= buf.length and
                      buf[data_start+1] is (data_len-2) & 0xff
                      buf[data_start+2] is (data_len-2) >> 8)
                    data_start += 3
                    data_end += 1
                    data_len -= 2
                  if data_len < 0 then continue
                  if data_end > buf.length then continue
                  bad = false
                  chars = for b in buf[data_start...data_end]
                    if b <= 3 then bad = true
                    String.fromCharCode b
                  if bad then continue
                  cb chars.join(''), addr + data_start

The rest of the object types are boring -- you can tell, because
they don't bother to "encrypt" any of their contents.

              when 10  # XFCN
                block.skip block.u8()
              else  # 7, 8 are "func/obj predecl"
                block.skip block.u16()

None of the other block types is interesting either.  Skip to the
next block:

        stream.seek next_pos

That's it!  Seems to work!  Probably!

### ADRIFT

So, uh, gosh, I ran into this ADRIFT game (blorbed, no less!) and
I ran `strings` on it and it found some XML but it wasn't very
satisfying XML so I did a bit of digging and... gosh.  Yeah.  Doesn't
look like there's a public spec.  Seems decidedly secret, in fact!
A few people reverse-engineered some earlier versions of the file
format, though, in order to make their own interpreters, so they
could play games on non-Windows platforms.  Sounds like the effort
required was pretty high, and the punch line (from my perspective)
involved some combination of zlib and Visual Basic's PRNG.

So I could *probably* somehow get this to work with ADRIFT 3.8/3.9/4
files, but I haven't happened to run in to any of those recently,
so for now I'm waiting until that happens naturally.

More interesting would be ADRIFT 5, the latest, but if anyone's
reverse-engineered that one yet, I haven't seen it.  Maybe because
there's that Mono version of the official thing that allegedly runs
on Linux and even on OS X even though it says it's untested but
like what could possibly go wrong, right?  I mean I can't blame the
ADRIFT people (person?), like I *have* a Mac and *I* don't really
want to be the first one to test it either.  That can't be right,
I bet lots of people have tested it, I bet it works fine.  I just...
I hate installing software, you know?  Meaning Mono, in this case.
Plus my computer is really old and won't take OS upgrades anymore
so it's pretty far behind at this point and the odds of any given
thing actually working are... well, I don't know, I mean, sometimes
something will work.  Like, node still works, apparently.

So, okay, I guess what I would realistically need is a decent
disassembler for, uh, what do you even call it?  .NET?  And there
seem to be some of those floating around, but they seem to be
Windows-only.  Not even Mono.  I know, right?  And, gosh, I don't
know.  That doesn't sound like a fun thing to try to make happen
on a weekday evening.

But if any of you fine folks ever happen to manage to figure out
how to deobfuscate one of these ADRIFT 5 TAF files to the point
where `strings` works (or whatever, like maybe it'll end up being
UTF-16-LE or something, I could totally see that), just, like,
contact me through GitHub or whatever.

### extract_strings

And finally, a function that extracts strings from any of the above
types of file.

Actually why don't we make it work for `.zip` files too?  I think
there's a library....

    exports.extract_strings = (bytes, cb) ->
      exports.extract_glulx_strings bytes, cb
      exports.extract_zcode_strings bytes, cb
      exports.extract_tads2_strings bytes, cb
      exports.extract_t3_strings bytes, cb
      exports.unblorb {bytes, usage: 'Exec'}, (resource) ->
        exports.extract_strings resource.bytes, cb
      if require('is-zip') bytes
        require('zip').Reader(bytes).forEach (entry) ->
          exports.extract_strings entry.getData(), cb

To be polite, I've exported the other functions too, but that's the
one you probably want.

### CLI

There is now a web UI in `index.html`, built from `index.jade`.

This module also defines a node CLI that I was using to see see if
this still works after translating it from the Python.  Might remove
it later, or not.  You could run this as `coffee -l README.md
foo.gblorb`, I suppose, or as `node README.js foo.gblorb`.

I should probably move this to its own file, though.

Hmm, so, how do we check whether we're being invoked directly as a
node.js script, as opposed to being `require`d by someone else's
script?  Right:

    if module is require.main
      fs = require 'fs'
      for file in process.argv[2..]
        bytes = fs.readFileSync file
        exports.extract_strings bytes, (s) ->
          s = s.trimRight()
          if s then console.log s

I'm applying `trimRight` because leading whitespace can sometimes
be interesting, but trailing whitespace is hard to even see, except
if it's a trailing newline of course, in which case it's just
annoying, at least when presented in this way.  I'm waiting until
this late in the game to trim because it's easy to imagine someone
wanting to build something on top of `extract_strings` that did
care about trailing whitespace.  I figure if you're using this CLI
wrapper but you're piping it into something else and you want it
to not trim, you'll just hack it up to not trim.  And maybe use
`'\x00'` string terminators instead of `console.log`'s newlines,
or something.

Hmm... the output doesn't seem to be completely identical to the
Python version.  A few of the false positives in the test file I
tried are missing.  I suppose if I were feeling ambitious I would
track down the discrepancy and fix either that version or this one.

For a large-ish Glulx game (Hadean Lands), it looks like the
Javascript version runs in less than 10% of the time the Python
takes, even though the Python version is leaning more heavily on C
modules (`struct` and `re`) to try to help speed up things that the
Javascript version is just doing by itself.  Javascript (and node
in particular) tends to be much faster for this kind of compute-heavy
stuff, because so many resources get poured into improving the JIT,
because web browsers.

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
