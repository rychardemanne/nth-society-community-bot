'use strict';

const
  path = require("path"),
  mongodb = require("mongodb"),
  moment = require('moment'),
  S = require('string'),
  fs = require('fs'),
  wait = require('wait.for');

const
  DB_GENERAL = "general",
  DB_KNOWN_USERS = "known_users",
  DB_KNOWN_REPOS = "known_repos",
  DB_POSTS_BACKLOG = "posts_backlog",
  DB_VOTE_BACKLOG = "vote_backlog";

const
  VOTE_POWER_1_PC = 100,
  DATE_FORMAT = "dddd, MMMM Do YYYY, h:mm:ss a";

var db;

var mAccount = null;
var mProperties = null;
var mChainInfo = null;


// Connect to the database first

function start(callback) {
  mongodb.MongoClient.connect(process.env.MONGODB_URI, function (err, database) {
    if (err) {
      console.log(err);
      process.exit(1);
    }

    db = database;
    console.log("Database connection ready");

    init(function () {
      callback();
    });
  });
}

function init(callback) {
  wait.launchFiber(function() {
    // get steem global properties first, needed for SP calc
    mProperties = wait.for(steem_getSteemGlobalProperties_wrapper);
    console.log("global properties: "+JSON.stringify(mProperties));
    mChainInfo = wait.for(steem_getChainProperties_wrapper);
    console.log("chain info: "+JSON.stringify(mChainInfo));
    // get Steem Power of bot account
    var accounts = wait.for(steem_getAccounts_wrapper, process.env.STEEM_USER);
    if (accounts !== undefined && accounts !== null && accounts.length > 0) {
      mAccount = accounts[0];
    } else {
      mAccount = null;
    }
    console.log("account: "+JSON.stringify(mAccount));
    // set up some vars
    MIN_SP = Number(process.env.MIN_SP);
    callback();
  });
}


// --- DB FUNCS

function getLastBlockProcessed(callback) {
  db.collection(DB_GENERAL).find({}).toArray(function(err, data) {
    var lastBlockProcessed = 0;
    if (err || data === null || data === undefined || data.length === 0) {
      console.log("No last infos data in db, is first time run, set up" +
        " with defaults");
      if (process.env.STARTING_BLOCK_NUM !== undefined
        && process.env.STARTING_BLOCK_NUM !== null) {
        lastBlockProcessed = Number(process.env.STARTING_BLOCK_NUM);
      }
    } else {
      lastBlockProcessed = data[0]["last_block_processed"];
    }
    callback(lastBlockProcessed);
  });
}

function getDbCursor(db_name, limit) {
  var cursor = null;
  if (limit !== undefined && limit !== null) {
    cursor = db.collection(db_name).find({}).limit(limit);
  } else {
    cursor = db.collection(db_name).find({});
  }
  return cursor;
}

function getDb(db_name, callback) {
  db.collection(db_name).find({}).toArray(function(err, data) {
    if (callback !== undefined && callback !== null) {
      if (err || data === null || data === undefined) {
        callback(data);
      }
      callback(null);
    }
  });
}

function dropDb(db_name) {
  db.collection(db_name).drop();
}

function saveDb(db_name, obj, callback) {
  db.collection(db_name).save(obj, function (err, data) {
    if (callback !== undefined && callback !== null) {
      callback(err, data);
    }
  });
}

// --- STEEM FUNCS
// NOTE!!! ALL FUNCTIONS JUST STUBS, THIS IS THE NO STEEM VERSION OF THE LIB SCRIPT

/*
 getSteemPowerFromVest(vest):
 * converts vesting steem (from get user query) to Steem Power (as on Steemit.com website)
 */
function getSteemPowerFromVest(vest) {
  return 0;
}

function steem_getBlockHeader_wrapper(blockNum, callback) {
  callback(new Error("Called a stub steem function"), null);
}

function steem_getBlock_wrapper(blockNum, callback) {
  callback(new Error("Called a stub steem function"), null);
}

function steem_getDiscussionsByCreated_wrapper(query, callback) {
  callback(new Error("Called a stub steem function"), null);
}

function steem_getSteemGlobalProperties_wrapper(callback) {
  callback(new Error("Called a stub steem function"), null);
}

function steem_getChainProperties_wrapper(callback) {
  callback(new Error("Called a stub steem function"), null);
}

/**
 *
 * @param type, can be "post" or "comment"
 * @param callback, function with usual (err, data) args
 */
function steem_getRewardFund_wrapper(type, callback) {
  callback(new Error("Called a stub steem function"), null);
}

function steem_getCurrentMedianHistoryPrice_wrapper(callback) {
  callback(new Error("Called a stub steem function"), null);
}

function steem_getAccounts_wrapper(author, callback) {
  callback(new Error("Called a stub steem function"), null);
}

function steem_getAccountCount_wrapper(callback) {
  callback(new Error("Called a stub steem function"), null);
}

function steem_getAccountHistory_wrapper(start, limit, callback) {
  callback(new Error("Called a stub steem function"), null);
}

function steem_getContent_wrapper(author, permlink, callback) {
  callback(new Error("Called a stub steem function"), null);
}

// --- MISC FUNCS

function timeout_wrapper(delay, callback) {
  setTimeout(function() {
    callback(null, true);
  }, delay);
}

function loadFileToString(filename, callback) {
  fs.readFile(path.join(__dirname, filename), {encoding: 'utf-8'}, function(err,data) {
    var str = "";
    if (err) {
      console.log(err);
    } else {
      str = data;
    }
    if (callback) {
      callback(str);
    }
  });
}

// EXPORTS

// consts

module.exports.VOTE_POWER_1_PC = VOTE_POWER_1_PC;

module.exports.DB_GENERAL = DB_GENERAL;
module.exports.DB_KNOWN_USERS = DB_KNOWN_USERS;
module.exports.DB_KNOWN_REPOS = DB_KNOWN_REPOS;
module.exports.DB_POSTS_BACKLOG = DB_POSTS_BACKLOG;
module.exports.DB_VOTE_BACKLOG = DB_VOTE_BACKLOG;

// getters

module.exports.getAccount = function() {return mAccount};
module.exports.getProperties = function() {return mProperties};
module.exports.getTestAuthorList = function() {return mTestAuthorList};
module.exports.setAccount = function(account) {mAccount = account;};

// functions

module.exports.saveDb = saveDb;
module.exports.dropDb = dropDb;
module.exports.getDb = getDb;
module.exports.getDbCursor = getDbCursor;
module.exports.getLastBlockProcessed = getLastBlockProcessed;

module.exports.getSteemPowerFromVest = getSteemPowerFromVest;
module.exports.steem_getBlockHeader_wrapper = steem_getBlockHeader_wrapper;
module.exports.steem_getBlock_wrapper = steem_getBlock_wrapper;
module.exports.steem_getDiscussionsByCreated_wrapper = steem_getDiscussionsByCreated_wrapper;
module.exports.steem_getSteemGlobalProperties_wrapper = steem_getSteemGlobalProperties_wrapper;
module.exports.steem_getCurrentMedianHistoryPrice_wrapper = steem_getCurrentMedianHistoryPrice_wrapper;
module.exports.steem_getChainProperties_wrapper = steem_getChainProperties_wrapper;
module.exports.steem_getRewardFund_wrapper = steem_getRewardFund_wrapper;
module.exports.steem_getAccounts_wrapper = steem_getAccounts_wrapper;
module.exports.steem_getAccountCount_wrapper = steem_getAccountCount_wrapper;
module.exports.steem_getAccountHistory_wrapper = steem_getAccountHistory_wrapper;
module.exports.steem_getContent_wrapper = steem_getContent_wrapper;

module.exports.start = start;
module.exports.timeout_wrapper = timeout_wrapper;
module.exports.loadFileToString = loadFileToString;
