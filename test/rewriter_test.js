// test the db path

/* global require console process describe it */

var should = require('should')

var superagent = require('superagent')
var http = require('http')

var express = require('express')

var env = process.env;
var testhost = env.TEST_HOST || '127.0.0.1'
var testport = env.TEST_PORT || 3000
testport += 1
var chost = env.COUCHDB_HOST || '127.0.0.1'
var cport = env.COUCHDB_PORT || 5984
var cuser = env.COUCHDB_USER
var cpass = env.COUCHDB_PASS

var couch = 'http://'+chost+':'+cport
var queue = require('queue-async')

var app,server

var couch_dbname,cdb;


function pipetest(req,res,next){
    // source is some known doc in couchdb, which will come back json
    console.log('pipe test')
    var from = cdb + '/mydocid';
    var cdb_req = superagent.get(from)
                  .accept('application/json')
    cdb_req.pipe(res);
    return null
}
before(
    function(done){
        var q = queue()
        // create server
        q.defer(function(cb){
            app = express()
            app.get('pipetest',pipetest)
            server=http
                   .createServer(app)
                   .listen(testport,function(){
                       console.log('server listening')
                       return cb()
                   })
            return null
        })
        // create couchdb test stuff
        q.defer(function(cb){
            var qq = queue(1)
            var date = new Date()
            couch_dbname = ['test',
                            date.getHours(),
                            date.getMinutes(),
                            date.getSeconds(),
                            date.getMilliseconds()].join('-')
            cdb ='http://'+ chost+':'+cport +'/' + couch_dbname
            qq.defer(function(cbb){
                console.log('creating '+cdb+'/mydocid')
                superagent.put(cdb)
                .auth(cuser,cpass)
                .accept('application/json')
                .end(function(e,r){
                    if(e) console.log('problem creating',e)
                    should.exist(r.body)
                    var status = r.body;
                    status.should.have.property('ok',true)
                    cbb(e)
                });
                return null
            })
            qq.defer(function(cbb){
                // populate some data
                console.log('writing '+cdb+'/mydocid')
                superagent.put(cdb+'/mydocid')
                .send('{"name":"james","pet":"farfalla"}')
                .accept('application/json')
                .end(function(e,r){
                    if(e) console.log('problem writing',e)
                    return cbb(e);
                })
                return null
            })
            qq.defer(function(cbb){
                // prove the data is there before testing
                console.log('checking '+cdb+'/mydocid')
                superagent.get(cdb+'/mydocid')
                .accept('application/json')
                .end(function(e,r){
                    console.log(r.body)
                    if(e) console.log('problem getting',e)
                    should.exist(r.body)
                    r.body.should.have.property('name','james')
                    r.body.should.have.property('pet','farfalla')
                    return cbb(e);
                })
                return null
            })
            qq.await(function(e){
                return cb(e)
            })
            return null
        })
        q.await(function(e){
            return done(e)
        })
    })


after(function(done){
    superagent.del(cdb)
    .auth(cuser,cpass)
    .end(function(e,r){
        if(e) console.log('problem deleting',e)
        return done(e);
    })
    return null
})

describe('pipe test ',function(){
    it('should return a doc from couchdb'
      ,function(done){
           superagent
           .get('http://'+ testhost +':'+testport+'/pipetest')
           .set('accept','application/json')
           .set('followRedirect',true)
           .end(
               function(err,res){
                   //console.log(err)
                   //console.log(res)
                   if(err) return done(err)
                   should.exist(res.body)
                   var c = res.body
                   console.log(c)
                   c.should.have.property('name','james')
                   c.should.have.property('pet','farfalla')
                   return done()
               })
           return null
       })
    return null
})
