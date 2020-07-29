var _db;

// connect db, if success listen to port
let initDbConection = function(callback){
  const MongoClient = require('mongodb').MongoClient;
  const uri = "mongodb+srv://dbMqttTest:PNThoai9x@cluster0-u7lvh.mongodb.net/test?retryWrites=true&w=majority";
  const mongoOptions = {
    poolSize: 1000,
    promiseLibrary: global.Promise,
    useUnifiedTopology: true
  };

  MongoClient.connect(uri, mongoOptions, function(err, client) {
    if(err) console.log(err);
    _db = client.db('dbMqttTest');
    callback();
  });
};

let db = function(){
  return _db;
};

module.exports = { db, initDbConection };
