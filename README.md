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

