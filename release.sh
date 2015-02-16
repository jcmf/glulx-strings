#!/bin/sh
set -ex
test -n "$*"
cd "`dirname $0`"
test -z "`git status --porcelain 2>&1`"
npm install
test -z "`git status --porcelain 2>&1`"
npm version --git-tag-version=false "$@"
version="v`node -e 'console.log(JSON.parse(require("fs").readFileSync("package.json", "utf8")).version)'`"
npm publish
git commit -am "$version"
git tag -am "$version" "$version"
git push
ssh toastball.net 'cd www/toastball.net/glulx-strings && git pull'
