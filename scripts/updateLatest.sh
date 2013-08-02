cat latest.js | pbcopy && git checkout gh-pages && pbpaste > latest.js && git commit -am 'update latest.js' && git push origin gh-pages && git checkout master && echo 'updated latest.js'
