Okay, so, I want to make an `.html` file.  How hard could it be?

Supposedly `gulp` will find this file, extract the code from it and
evaluate (run) it all via CoffeeScript, then run whichever "task"
it was asked to run.  Which sounds convenient, I guess.

Oh hey, can I get this thing to compile the node module as well?  I bet I
can.  Let's start with that.

Let's use the default task for now?  Maybe later if I have more
than one I can name them after the corresponding `package.json`
hook.  Right now I just have a `prepublish` hook which I'm running
via `npm install`, mostly to save me the trouble of having to worry
about a global CoffeeScript install.

    gulp = require 'gulp'
    plugins = require('gulp-load-plugins')()

    gulp.task 'default', ->

Okay.  How do we get gulp to compile CoffeeScript?  There must be an
example around here somewhere.

I think I need to find the coffeeification plugin and look at the docs
for that?

Maybe this `gulp-coffee` thing?

Oh hey yeah, the PDF cheat sheet totally mentions it.

      gulp.src 'README.md'
      .pipe plugins.coffee literate: yes, header: yes
      .pipe gulp.dest '.'

Gosh, is that even syntactically valid?  Let's find out....

Yes, it's syntactically valid.  Wow, gotta start using that.  I had
to tweak the arguments a bit to get everything to come out the same,
but it seems to be working now!  I guess it's a bit more longwinded
than writing `coffee -cl README.md`, but I am okay with that, given
my plans for the `.html` file.

Let me just commit this....

Okay, what is the next step here?  For the HTML thing?

Let's start with an `index.jade`:

      gulp.src 'index.jade'
      .pipe plugins.jade()

Let me just verify that this works... hmm, doesn't need me to install
`jade` but does need `marked`... okay, there we go, that looks
right.

Can I use [Stylus](http://learnboost.github.io/stylus/) for my CSS?
Does [Jade](http://jade-lang.com/) already know about Stylus?  I
don't see a list of filters... oh but `lib/filters.js` looks like
it'll work with anything that
[`transformers`](https://www.npmjs.com/package/transformers) knows
about, and `transformers` totally knows about Stylus!  So probably I
can just do that right in `index.jade` and it'll all be cool?

Yes, it works!  Needs me to install `stylus` first, not surprisingly.

Now I need... hmm, this is the tricky part.  I want to inline a
browserified script, probably coming from an external `.coffee.md`
file, so I can exposit all over it.

You know, I wonder if I could have a `.jade.md` file.  Like, I don't
think Jade explicitly supports that, but with this gulp thing it
seems like Jade doesn't even need to necessarily know about it.  It
can be our little secret.  At which point I could just inline the
code...  though the indentation level might be a bit high... no, I
think it could work.  And it's not like we're going to need a ton
of code in there, so restricting it to a single file might be
reasonable.

Oh but having the `:markdown` section inside the `.jade.md` file...
gosh, I think my head might explode.

Or not.  I mean, that's almost sort of a reasonable thing to do,
isn't it?  I think it actually might be....

So maybe I should first be trying for inline browserified CoffeeScript,
and then see if I can `.jade.md`ify that.  Because I mean surely this is
all very doable, and probably there are plugins already that do all of
these things.

Although... you know... I bet Jade's going to get awfully confused about
source file names and line numbers.  That might get annoying quickly.

Either way, though, inlined browserified CoffeeScript is a place to start,
right?

Let me try with just plain inlining first, via `gulp-inline`, then
see if I can get it to work with (say) `gulp-coffeeify`.

    #  .pipe plugins.inline base: '.', js: plugins.coffeeify()
    #  .pipe gulp.dest '.'

Nope, doesn't work.  I've tried with and without coffeeify.  What
am I doing wrong?

Maybe if I set base?

Oh!  I bet I need to include the script file in the input stream!

How the heck am I gonna do that?

Let's go back to trying without coffeeify:

    #  .pipe plugins.inline()
    #  .pipe gulp.dest '.'

All right, now we need to... uh... we need to inject something into
the stream.  Something that isn't going to run through jade.  Hmm.

No, I'm wrong.  Look at this example!  That's definitely not how
this thing is supposed to work.

Does it want a leading slash in the script's src attribute?  That seems
bizarre, but I can try it....

Not helping.  Maybe if I set the script's type attribute?

Yes, that worked!!!!

And I only needed to give it a base to counteract the weird leading
slash, I think.  Yes, that kinda makes sense now that I think about
it.

But will it coffeeify?

    #  .pipe plugins.inline js: plugins.coffeeify()
    #  .pipe gulp.dest '.'

Boy will it ever.  Good!

Will it work if I switch to `.coffee.md`?

Nope.  Not out of the box, anyway.  Presumably coffeeify has some
way to let me specify compiler options?  Let me just go back and try
the obvious thing....

    #  .pipe plugins.inline js: plugins.coffeeify literate: yes
    #  .pipe gulp.dest '.'

nope.  OK, time to look at the source.

Hmm, not sure it's going to let me pass options to the compiler.

Yeah, the more I look at this the sketchier it seems.

`gulp-browserify-thin` looks plausible but it's only a half-solution
-- it makes it easier to hook the output of browserify into gulp,
but it doesn't help you hook the output of gulp into browserify, if I
am understanding this correctly.

Aha, `gulp-browatchify` must be what I want.

Wonder if I could even use browserify directly, if it came to that.
Just pass the contents of the script tag to Jade as a named variable
or something.  Seems a little ugly, though.

OK, where was I?  Right, trying the new thing:

    #  .pipe plugins.inline js: plugins.browatchify transforms: ['coffeeify']
    #  .pipe gulp.dest '.'

Huh!  This is... not... good.

Back up, try it with plain .js:

      .pipe plugins.inline js: plugins.browatchify()
      .pipe gulp.dest '.'

Fails with the same-looking crazy error message.  Golly.

Okay, maybe browatchify is no good?

Hmm, surely the browserify folks have an opinion on how to work with gulp?

Indeed: https://github.com/gulpjs/gulp/blob/master/docs/recipes/fast-browserify-builds-with-watchify.md


