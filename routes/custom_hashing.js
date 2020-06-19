let secid = 'watering';

const md5 = require("md5");

module.exports = {
  hash(rawPassword, options = {}) {
    const salt = options.salt ? options.salt : new Date().getTime();

    const rounds = options.rounds ? options.rounds : 10;

    let hashed = md5(rawPassword + salt);
    for (let i = 0; i <= rounds; i++) {
      hashed = md5(hashed);
    }
    return `${salt}$${rounds}$${hashed}`;
  },

  compare(rawPassword, hashedPassword) {
    try {
      const [ salt, rounds ] = hashedPassword.split('$');
      const hashedRawPassword = this.hash(rawPassword, { salt, rounds });
      return hashedPassword === hashedRawPassword;
    } catch (error) {
      throw Error(error.message);
    }
  },

  getSecId() {
    return secid;
  },
};