'use strict';

const
  path = require("path"),
  mongodb = require("mongodb"),
  lib = require('./lib.js');


function main() {
  lib.start(function () {
    lib.loadFileToString("/first_time_db.json", function(jsonStr) {
      var firstTimeDbJson = JSON.parse(jsonStr);
      if (firstTimeDbJson !== undefined && firstTimeDbJson !== null) {
        if (firstTimeDbJson[lib.DB_GENERAL] !== undefined && firstTimeDbJson[lib.DB_GENERAL] !== null) {
          lib.saveDb(lib.DB_GENERAL, firstTimeDbJson[lib.DB_GENERAL], function(err, data) {
            if (err) {
              console.error(err);
            }
          });
        }
        var listTypeDbs = [
          lib.DB_KNOWN_USERS,
          lib.DB_KNOWN_REPOS,
          lib.DB_POSTS_BACKLOG,
          lib.DB_VOTE_BACKLOG
        ];
        for (var dbName in listTypeDbs) {
          if (firstTimeDbJson[dbName] !== undefined
              && firstTimeDbJson[dbName] !== null
              && firstTimeDbJson[dbName].length > 0) {
            lib.saveDb(dbName, firstTimeDbJson[dbName], function(err, data) {
              if (err) {
                console.error(err);
              }
            });
          }
        }
      }
    });
  });
}


// START THIS SCRIPT
main();
