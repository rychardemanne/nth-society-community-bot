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
        for (var dbNameAttrib in listTypeDbs) {
          var dbName = listTypeDbs[dbNameAttrib];
          console.log("Looking at db "+dbName+" ...");
          if (firstTimeDbJson[dbName] !== undefined
              && firstTimeDbJson[dbName] !== null
              && firstTimeDbJson[dbName].length > 0) {
            console.log(" - is valid");
            for (var itemAttrib in firstTimeDbJson[dbName]) {
              var item = firstTimeDbJson[dbName][itemAttrib];
              console.log(" - - adding item: "+JSON.stringify(item));
              lib.saveDb(dbName, item, function(err, data) {
                if (err) {
                  console.error(err);
                }
              });
            }
          }
        }
      }
      process.exit();
    });
  });
}


// START THIS SCRIPT
main();
