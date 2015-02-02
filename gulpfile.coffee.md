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
    gulp.task 'default', ->

Okay.  How do we get gulp to compile CoffeeScript?  There must be an
example around here somewhere.

I think I need to find the coffeeification plugin and look at the docs
for that?

Maybe this `gulp-coffee` thing?

Oh hey yeah, the PDF cheat sheet totally mentions it.

      coffee = require 'gulp-coffee'
      gulp.src 'README.md'
      .pipe coffee literate: yes, header: yes
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

      jade = require 'gulp-jade'
      gulp.src 'index.jade'
      .pipe jade()
      .pipe gulp.dest '.'

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
