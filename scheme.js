const mongoose = require('mongoose');
const connect  = mongoose.createConnection('mongodb://127.0.0.1:27017/unix_socket', {
  serverSelectionTimeoutMS: 5000,
  useNewUrlParser         : true,
  useCreateIndex          : true,
  useFindAndModify        : false,
  useUnifiedTopology      : true,
});
connect.once('open', () => {
  console.info('mongoose|connect|open');
});
connect.once('error', (error) => {
  console.error('mongoose|connect|error', error);
  process.exit(1);
});

const Schema = mongoose.Schema;

/**
 * Схема списка подключения
 * @type {Schema}
 */
const schemaTasks = new Schema({

  serverName: {
    type    : String,
    required: true,
    index   : true
  },

  body: {
    type    : {},
    required: true,
  },

  option: {
    type    : {},
    required: true,
  },

}, {timestamps: true});
module.exports.ModelTasks = connect.model('tasks', schemaTasks);