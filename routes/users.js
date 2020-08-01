var express = require('express');
const cookieParser = require("cookie-parser");
const session = require("express-session");
var router = express.Router();
const hashing = require('../routes/custom_hashing');

const requestIp = require('request-ip');
const publicIp = require('ip');

var userLst = {};

// middleware function to check for logged-in users
var sessionChecker = (req, res, next) => {
  if (req.session.user || req.signedCookies.secid) {
  	req.session.user = req.signedCookies.secid;
    res.redirect('/');
  } else {
    next();
  }
};


// connect db
const db = require('../routes/dbConnection').db;

/* GET users listing. */
router.get('/', sessionChecker, async function(req, res, next) {
  let clientIP = requestIp.getClientIp(req);
  // console.log(clientIP, userLst[clientIP]);
  if(!(clientIP in userLst)){
    userLst[clientIP] = {
      loginCnt: 0,
      timeOut: undefined,
      ip: clientIP=='::1' ? await publicIp.address() : clientIP,
    };
  }

	console.log('req login:', req.url);
  res.render('../views/login');
});

router.post('/', function(req, res) {
	let username = req.body.data.username;
	let password = req.body.data.password;
  let clientIP = requestIp.getClientIp(req);

  // console.log(clientIP, userLst[clientIP]);

  if(userLst[clientIP].timeOut !== undefined){
    res.send({ msg: 'You have input too many times, wait!', tagMsg: "whole", success: false });
    return;
  }

  // try 9 times
  if(userLst[clientIP].loginCnt > 8){
    res.send({ msg: 'You have input too many times, wait 30s', tagMsg: "whole", success: false });
    // cooldown timeout
    userLst[clientIP].timeOut = setTimeout(()=>{
        userLst[clientIP].loginCnt = 0;
        userLst[clientIP].timeOut = undefined;
    }, 30*1000);
    return;
  }

	console.log('post login:', req.url);
  // console.log(username, password);
	db().collection('user').find({ username: username }).toArray(function(err, user) {
		if(err) console.log(err);

		user = user[0];
		// console.log(user);
		if(req.body.data.type.includes('login')){
			if(username.length === 0){
        userLst[clientIP].loginCnt++;
				res.send({ msg: 'username cannot be empty!', tagMsg: "username", success: false });
			} else if(password.length === 0){
        userLst[clientIP].loginCnt++;
				res.send({ msg: 'password cannot be empty!', tagMsg: "password", success: false });
			} else {
				if(user == undefined){
          userLst[clientIP].loginCnt++;
					res.send({ msg: 'user not existed!', tagMsg: "username", success: false });
				} else if(!hashing.compare(password, user.password)){
          userLst[clientIP].loginCnt++;
					res.send({ msg: 'password is incorrect!', tagMsg: "password", success: false });
				} else {
			    let options = {
		        maxAge: 1000 * 60 * 60 * 24, // expire after 1 day
		        httpOnly: true, // The cookie only accessible by the web server
		        signed: true // Indicates cookie should be signed
			    }
			    req.session.user = hashing.hash(username, {salt: username, rounds: 20});
					res.cookie("secid", hashing.hash(username, {salt: username, rounds: 20}), options);
          userLst[clientIP].loginCnt = 0;
          userLst[clientIP].username = username;
					res.send({ success: true });
					console.log('new user from:', req.url);
				}
			}
		} else if(req.body.data.type.includes('register')){
			let repassword = req.body.data.repassword;

			if(username.length === 0){
				res.send({ msg: 'username cannot be empty!', tagMsg: "username", success: false });
			} else if(password.length === 0){
				res.send({ msg: 'password cannot be empty!', tagMsg: "password", success: false });
			} else if(password.localeCompare(repassword)){
				res.send({ msg: 'password and re-type password dont match!', tagMsg: "repassword", success: false });
			} else if(!/^([A-Za-z_]+[A-Za-z_0-9]{7,})$/.test(username)){
				res.send({ msg: 'username must be alphabet, _, or numeric and first character cant be numeric, also greater than 8!', tagMsg: "username", success: false });
			} else if(!/^([A-Za-z_]+[a-z_0-9]{7,})$/.test(password)){
				res.send({ msg: 'password must be alphabet, _, or numeric and first character cant be numeric, also greater than 8!', tagMsg: "password", success: false });
			} else if(user != undefined){
				res.send({ msg: 'user existed!', tagMsg: "username", success: false });
			} else {
				db().collection('user').insertOne({ username: username, password: hashing.hash(password, {salt: username, rounds: 20}) }, (err)=>{
					if(err) console.log(err);
			    let options = {
		        maxAge: 1000 * 60 * 60 * 24, // expire after 1 day
		        httpOnly: true, // The cookie only accessible by the web server
		        signed: true // Indicates cookie should be signed
			    }
			    req.session.user = hashing.hash(username, { salt: username, rounds: 20 });
					res.cookie("secid", hashing.hash(username, {salt: username, rounds: 20}), options);
          userLst[clientIP].loginCnt = 0;
          userLst[clientIP].username = username;
					res.send({ success: true });
					console.log('new user from:', req.url);
				});
			}
		}
		// res.send({ success: true });
	});
});

module.exports = { router, getUserLst: ()=>{
  return userLst;
}};
