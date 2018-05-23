/* eslint-env node */

const path = require('path');
const fs = require('fs');

const NODE_ENV = process.env.NODE_ENV || 'development';
const production = NODE_ENV === 'production';

module.exports = function initGrunt(grunt) {
  grunt.loadNpmTasks('grunt-contrib-stylus');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-pug');

  grunt.loadNpmTasks('grunt-modernizr');
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-copy');

  var defaultConfigPath = './_js/config/development.json';
  var envConfigPath = './_js/config/' + process.env.NODE_ENV + '.json';
  var configPath = grunt.file.exists(envConfigPath) ? envConfigPath : defaultConfigPath;

  grunt.initConfig({
    stylus: {
      compile: {
        options: {
          use: [
            require('yeticss'),
            require('autoprefixer-stylus')
          ]
        },
        files: {
          'public/css/main.css': ['_styl/main.styl']
        }
      }
    },

    cssmin: {
      target: {
        files: [{
          expand: true,
          cwd: 'public/css',
          src: ['*.css', '!*.min.css'],
          dest: 'public/css',
          ext: '.min.css'
        }]
      }
    },

    pug: {
      basic: {
        options: {
          data: {
            jsExt: production ? '.min.js' : '.js',
          }
        },
        files: [{
          expand: true,
          cwd: '_pug',
          src: ['**/*.pug'],
          dest: 'public',
          ext: '.html',
          // Don't render pug files in include or with a _ in the front
          filter(src) {
            if (src.indexOf('include') > -1) {
              return false;
            }
            if (path.basename(src)[0] === '_') {
              return false;
            }
            return true;
          },
          // Move non index.html files into their own dir for clean paths
          rename(dest, src) {
            if (src !== 'index.html') {
              return `${dest}/${src.replace('.html', '/index.html')}`;
            }
            return `${dest}/${src}`;
          }
        }]
      }
    },

    // browserify each page from _js/bundles to the output js dir
    browserify: {
        main: {
            src: '_js/main.js',
            dest: 'public/js/main.js',
            options: {
              alias: {
                'config': configPath
              }
            }
        }
    },

    modernizr: {
      dist: {
        crawl: false,
        customTests: [],
        dest: 'public/js/modernizr.min.js',
        tests: [],
        options: [
          'prefixed',
          'html5shiv',
          'setClasses'
        ],
        uglify: true
      }
    },

    // - minify any js files in the output dir
    uglify: {
      target: {
        files: [{
          expand: true,
          cwd: 'public/js',
          src: ['*.js', '!*.min.js'],
          dest: 'public/js',
          ext: '.min.js',
          extDot: 'last'
        }]
      }
    },

    copy: {
      public: {
        files: [
          {
            cwd: '_assets',
            expand: true,
            src: ['**'],
            dest: 'public'
          }
        ]
      },
      legacyJs: {
        files: [
          {
            cwd: '_js',
            expand: true,
            src: ['audio.js', 'latest.js', 'latest-v2.js', 'latest-v3.js'],
            dest: 'public'
          }
        ]
      }
    },

    watch: {
      build: {
        files: ['_styl/**/*.styl', '_pug/**/*.pug', '_images/**', '_js/**'],
        tasks: ['build'],
        options: {
          livereload: true
        }
      }
    },

    connect: {
      server: {
        options: {
          port: 9001,
          hostname: '*',
          base: 'public',
          livereload: true,
          open: true
        }
      }
    }
  });

  grunt.registerTask('build', ['stylus', 'cssmin', 'modernizr', 'browserify', 'uglify', 'pug', 'copy']);
  grunt.registerTask('serve', ['build', 'connect:server', 'watch']);
  grunt.registerTask('default', ['build']);
};
