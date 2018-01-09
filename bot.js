'use strict';

const
  //steem = require("steem"),
  path = require("path"),
  mongodb = require("mongodb"),
  moment = require('moment'),
  S = require('string'),
  wait = require('wait.for'),
  lib = require('./lib_no_steem.js'), //TODO : return to use lib.js after steem-js updated to 0.7
  ApiGithub = require('api-github'),
  github_api = new ApiGithub({});

var
  MAX_BLOCKS_PER_RUN = 9000;


function main() {
  lib.start(function () {
    updateGitHubRepoForks(function () {
      checkGitHubUsersForKnownRepoActivity(function () {
        console.log("Finished");
        /*
        checkBlockchainForPostsAndComments(lib.getLastBlockProcessed() + 1, function () {
          checkPostsInBacklogForActivity(function () {
            console.log("Finished");
          });
        });
        */
      });
    });
  });
}

function updateGitHubRepoForks(callback) {
  // TODO
  lib.getDbCursor(lib.DB_KNOWN_REPOS).forEach(function(doc) {
    // handle
    github_api.repos
      .find(doc["github_name"] + "/" + doc["repo"])
      .then(function(repos) {
        console.log(repos);
      })
      .catch(console.error);
  }, function(err) {
    // done or error
    callback();
  });
}

function checkGitHubUsersForKnownRepoActivity(callback) {
  // TODO
  callback();
}

function checkBlockchainForPostsAndComments(startAtBlockNum, callback) {
  wait.launchFiber(function() {
    // get some info first
    var headBlock = wait.for(lib.steem_getBlockHeader_wrapper, lib.getProperties().head_block_number);
    var latestBlockMoment = moment(headBlock.timestamp, moment.ISO_8601);
    // chain stuff
    var rewardfund_info = wait.for(lib.steem_getRewardFund_wrapper, "post");
    var price_info = wait.for(lib.steem_getCurrentMedianHistoryPrice_wrapper);

    var reward_balance = rewardfund_info.reward_balance;
    var recent_claims = rewardfund_info.recent_claims;
    var reward_pool = reward_balance.replace(" STEEM", "") / recent_claims;

    var sbd_per_steem = price_info.base.replace(" SBD", "") / price_info.quote.replace(" STEEM", "");

    var steem_per_vest = lib.getProperties().total_vesting_fund_steem.replace(" STEEM", "")
      / lib.getProperties().total_vesting_shares.replace(" VESTS", "");

    // set up vars
    var currentBlockNum = 0;
    for (var i = startAtBlockNum; i <= lib.getProperties().head_block_number && i <= (startAtBlockNum + MAX_BLOCKS_PER_RUN); i++) {
      currentBlockNum = i;
      var block = wait.for(lib.steem_getBlock_wrapper, i);
      //console.log("block info: "+JSON.stringify(block));
      var transactions = block.transactions;
      for (var j = 0; j < transactions.length; j++) {
        var transaction = transactions[j];
        for (var k = 0 ; k < transaction.operations.length ; k++) {
          var opName = transaction.operations[k][0];
          var opDetail = transaction.operations[k][1];
          //try {
            if (opName !== undefined && opName !== null
              && opName.localeCompare("vote") == 0) {

              // check voter db voter
              var voterInfos = wait.for(lib.getVoterFromDb, opDetail.voter);
              if (voterInfos === null || voterInfos === undefined) {
                continue; //not a target
              }
              console.log("vote by blacklisted user: "+opDetail.voter);

              // get post content and rshares of vote
              var content;
              content = wait.for(lib.steem_getContent_wrapper, opDetail.author,
                opDetail.permlink);
              if (content === undefined || content === null) {
                console.log("Couldn't process operation, continuing." +
                  " Error: post content response not defined");
                continue;
              }
              var voteDetail = null;
              for (var m = 0; m < content.active_votes.length; m++) {
                if (content.active_votes[m].voter.localeCompare(opDetail.voter) == 0) {
                  voteDetail = content.active_votes[m];
                  break;
                }
              }
              if (voteDetail === null) {
                console.log("vote details null, cannot process, skip");
                continue;
              }

              // only counter positive votes
              if (voteDetail.rshares < 0
                  || voteDetail.rshares === 0) {
                console.log("not positive vote, skipping");
                continue;
              }

              // THIRD, check payout window still open
              var cashoutTime = moment(content.cashout_time);
              cashoutTime.subtract(7, 'hours');
              var nowTime = moment(new Date());
              if (!nowTime.isBefore(cashoutTime)) {
                console.log("payout window now closed, skipping");
                continue;
              }

              // get pending payout for flag negation
              console.log("content.pending_payout_value: "+content.pending_payout_value);
              var pending_payout_value = content.pending_payout_value.split(" ");
              var pending_payout_value_NUM = Number(pending_payout_value[0]);
              console.log("content.net_rshares: "+content.net_rshares);
              var self_vote_payout;
              if (pending_payout_value_NUM <= 0.00) {
                self_vote_payout = 0;
              } else if (content.active_votes.length === 1
                  || voteDetail.rshares === Number(content.net_rshares)) {
                self_vote_payout = pending_payout_value_NUM;
              } else {
                self_vote_payout = pending_payout_value_NUM * (voteDetail.rshares / Number(content.net_rshares));
              }
              if (self_vote_payout < 0) {
                self_vote_payout = 0;
              }
              console.log("self_vote_payout: "+self_vote_payout);

              // flag
              // update account
              var accounts = wait.for(lib.steem_getAccounts_wrapper, process.env.STEEM_USER);
              lib.setAccount(accounts[0]);
              var vp = recalcVotingPower(latestBlockMoment);
              var vestingSharesParts = lib.getAccount().vesting_shares.split(" ");
              var vestingSharesNum = Number(vestingSharesParts[0]);
              var receivedSharesParts = lib.getAccount().received_vesting_shares.split(" ");
              var receivedSharesNum = Number(receivedSharesParts[0]);
              var delegatedSharesParts = lib.getAccount().delegated_vesting_shares.split(" ");
              var delegatedSharesNum = Number(delegatedSharesParts[0]);
              var totalVests = vestingSharesNum + receivedSharesNum - delegatedSharesNum;

              var steempower = lib.getSteemPowerFromVest(totalVests);
              //console.log("steem power: " + steempower);
              var sp_scaled_vests = steempower / steem_per_vest;
              //console.log("sp_scaled_vests: " + sp_scaled_vests);

              //var oneval = (self_vote_payout * 100) / (sp_scaled_vests* 100 * reward_pool * sbd_per_steem);
              //console.log("oneval: " + oneval);
              //var votingpower = (oneval / (100 * (100 * vp) /lib.VOTE_POWER_1_PC)) * 100;

              var oneval = (self_vote_payout * 52) / (sp_scaled_vests * 100 * reward_pool * sbd_per_steem);
              var votingpower = ((oneval / (100 * vp)) * lib.VOTE_POWER_1_PC) / 100;

              console.log("voting power: " + votingpower);


              if (votingpower > 100) {
                votingpower = 100;
                console.log("capped voting power to 100%");
              }

              var counter_percentage = -votingpower;

              console.log("countering percentage: " + counter_percentage);

              var counter_pc_int = parseInt(counter_percentage.toFixed(2) * lib.VOTE_POWER_1_PC);

              console.log("countering percentage int format: " + counter_pc_int);

              if (counter_pc_int == 0) {
                console.log("countering percentage less than 0.01 pc," +
                  " skip");
                continue;
              }

              console.log("Voting...");
              var restricted = false;
              if (lib.getTestAuthorList() !== null
                && lib.getTestAuthorList() !== undefined
                && lib.getTestAuthorList().length > 0) {
                restricted = true;
                for (var m = 0; m < lib.getTestAuthorList().length; m++) {
                  if (opDetail.voter.localeCompare(lib.getTestAuthorList()[m]) === 0) {
                    restricted = false;
                    break;
                  }
                }
              }
              if (!restricted) {
                if (process.env.ACTIVE !== undefined
                    && process.env.ACTIVE !== null
                    && process.env.ACTIVE.localeCompare("true") == 0) {
                  //TODO: restore when steem-js upgraded to 0.7
                  /*
                  try {
                    var voteResult = wait.for(steem.broadcast.vote,
                      process.env.POSTING_KEY_PRV,
                      process.env.STEEM_USER,
                      opDetail.author,
                      opDetail.permlink,
                      counter_pc_int); // adjust
                    // pc to
                    // Steem scaling
                    console.log("Vote result: " + JSON.stringify(voteResult));
                  } catch (err) {
                    console.log("Error voting: " + JSON.stringify(err));
                    //callback();
                    //return;
                  }
                  */
                  console.log("Wait 3.5 seconds to allow vote limit to" +
                    " reset");
                  wait.for(lib.timeout_wrapper, 3500);
                  console.log("Finished waiting");
                } else {
                  console.log("Bot not in active state, not voting");
                }
              } else {
                console.log("Not voting, author restriction list not" +
                  " met");
              }
            }
            /*
          } catch (err) {
            console.log("Couldn't process operation, continuing. Error: "
              + JSON.stringify(err));
            continue;
          }
          */
        }
      }
    }
    console.log("processed blocks "+startAtBlockNum+" to " +
      currentBlockNum);
    var generalDb = lib.getDb(lib.DB_GENERAL);
    generalDb["last_block_processed"] = currentBlockNum;
    wait.for(lib.dbSave, lib.DB_GENERAL, generalDb);
    // exit
    callback();
  });
}

function checkPostsInBacklogForActivity(callback) {
  // TODO
  callback();
}

// util

function recalcVotingPower(latestBlockMoment) {
  // update account
  var accounts = wait.for(lib.steem_getAccounts_wrapper, process.env.STEEM_USER);
  var account = accounts[0];
  if (account === null || account === undefined) {
    console.log("Could not get bot account detail");
    return 0;
  }
  lib.setAccount(accounts[0]);
  var vp = account.voting_power;
  var lastVoteTime = moment(account.last_vote_time);
  var secondsDiff = (latestBlockMoment.valueOf() - lastVoteTime.valueOf()) / 1000;
  if (secondsDiff > 0) {
    var vpRegenerated = secondsDiff * 10000 / 86400 / 5;
    vp += vpRegenerated;
  }
  if (vp > 10000) {
    vp = 10000;
  }
  console.log(" - - new vp(corrected): "+vp);
  return vp;
}

// START THIS SCRIPT
main();
