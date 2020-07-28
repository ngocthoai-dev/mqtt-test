const db = require('../routes/dbConnection').db;

const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: 'guest121019@gmail.com',
    clientId: '490570341278-6lobi6mjkok82li9gd4fran7f31m9rjd.apps.googleusercontent.com',
    clientSecret: 't1sxhDBkE_SF9ztil7A7Tuq5',
    refreshToken: '1//046tYAusmP_amCgYIARAAGAQSNwF-L9Ir8WS80p1ITDKISHYFlo9m_Y_gFNxwUaOSYOKmYu-KKuWG3NTwt1cW0_B-fJjhkWFdVTE',
    accessToken: 'ya29.a0AfH6SMBVD5Ls4O0nHgHF4TNiaQrn_PxUHUKZN8MV2SpMDkfInvYU_Mw1blTbtz5zSUl0b8HO7FE-9tnIMDKjZR4EYTEWiWhgUl38mYYn1mMozUxp1HTcOBXwTTM2xqIsrp2trnSNB7MzQ0KVqq-x9KONDZaXi00HCxs',
  }
});

function sendMsg(from, to, callback, title='welcome!', content='hello'){
  let mailOptions = {
    from: from,
    to: to,
    subject: title,
    html: content,
  };

  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      callback(error);
    } else {
      callback('Email sent: ' + info);
    }
  });
}

let checkInDangerTree = ()=>{
  console.log('checkInDangerTree');

  function check(){
    db().collection('tree').find({

    }).toArray((err, trees)=>{
      if(err) throw err;

      trees.forEach((tree, i) => {
        let temp, mois, humi, today=new Date();
        today.setDate(today.getDate()-1);
        if(tree.currentData.temperature)
          temp = tree.currentData.temperature;
        if(tree.currentData.moisture)
          mois = tree.currentData.moisture;
        if(tree.currentData.humidity)
          humi = tree.currentData.humidity;
        if(temp > 40 || temp < -20 || humi > 100 || humi < 0 || mois > 50 || mois < -20){
          tree.user.forEach((user, i) => {
            db().collection('user').findOne({
              username: user.split('$')[0],
            }, (err, user)=>{
              if(err) throw err;

              if(user.email){
                sendMsg('guest121019@gmail.com', user.email, function(msg){
                  console.log(msg);
                }, 'ALERT: ' + tree.name + ' Need Water!',
                ('Dear ' + user.username + ',<br/><br/>' +
                'the ' + tree.name + ' tree with the temperature: <b>' + temp + '</b>;' + 'the moisture: <b>' + mois + '</b>;' + 'the humidity: <b>' + humi + '</b>;' +
                'need watering!<br/><br/>' +
                'Thanks for using our app,<br/>Sincerely,<br/>mqtt-test.'));
              }
            });
          });
        }
      });
    });
  }

  check();
  setInterval(check, 1000*60*10);
}

module.exports = { checkInDangerTree, sendMsg };
