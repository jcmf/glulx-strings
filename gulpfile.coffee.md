Okay, so, I want to make an `.html` file.  How hard could it be?

Supposedly `gulp` will find this file, extract the code from it,
evaluate (run) it all via CoffeeScript then run whichever "task"
it was asked to run.  Which sounds convenient, I guess.

Oh hey, can I get this thing to compile the node module as well?  I bet I
can.  Let's start with that.

Let's use the default task for now?  Maybe later if I have more
than one I can name them after the corresponding npm package.json
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
