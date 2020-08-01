const db = require('../routes/dbConnection').db;

const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: 'p3bear123456789@gmail.com',
    clientId: '18268562624-mm601fed89pu88fd5mi404dbofd32ist.apps.googleusercontent.com',
    clientSecret: 'kj6H0paFH-q15ctQp-_CIMC-',
    refreshToken: '1//04ZHjHDU7-mdXCgYIARAAGAQSNwF-L9IrnnEPvjI-iOZxTZq1a5GSNUTqQqMVNQrF7kwwIIKsCFCHPE3BJJFFf7_2-hQQxQDKATc',
    accessToken: 'ya29.a0AfH6SMBrXsmkcg7LHu1LtgwKsaOA4USzsmSEKpc75Z95TlHlDC9Ngc8l6pG9jAIpORUf0AYehg7kcMlB31A9TS21iZwbmFozTpPTQC2cUCCvdV5Owb3wBapQMfSwh5MljsG9Ncsg4Tblhxc2Jb7G0MZWOGwimvqkaYM',
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
      if(err) console.log(err);

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
              if(err) console.log(err);

              if(user.email){
                sendMsg('p3bear123456789@gmail.com', user.email, function(msg){
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
