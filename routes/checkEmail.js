const validator = require('email-validator');

function checkEmail(email){
  if(!validator.validate(email)){
    return false;
  }

  return true;
}

module.exports = { checkEmail };
