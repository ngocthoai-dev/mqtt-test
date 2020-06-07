function checkPhoneNumber(phone){
  if(phone.length < 9 && phone.length > 12){
    return false;
  }

  return true;
}

module.exports = { checkPhoneNumber };
