const net    = require('net');
const fs     = require('fs');
const scheme = require('./scheme');

async function wait(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

class UnixSocket {

  /**
   * Создание unix сервера
   * @param {string} serverName
   * @param {function} cb
   * @param {json} cb.data
   * @param {socket} cb.socket
   */
  server(serverName, cb = () => {}) {

    try {
      fs.unlinkSync(__dirname + '/sockets/' + serverName)
    } catch (e) {
    }

    const server = net.createServer((socket) => {

      socket.on('data', function (data) {
        cb(JSON.parse(data.toString()), function (s) {
          // console.log(s)
          socket.write(JSON.stringify(s) + '\r\n');
          socket.pipe(socket);
          socket.end();
        })
      });

      socket.on('end', () => {
      });
    });

    server.on('error', (err) => {
      console.error(err);
    });

    server.listen(__dirname + '/sockets/' + serverName, async () => {
      console.log('Unix socket listening: ' + __dirname + '/sockets/' + serverName);
      await this.tasksLoad(serverName);
    });

  }

  /**
   * Згрузка задачь из базы
   * @param serverName
   * @returns {Promise<void>}
   */
  async tasksLoad(serverName) {

    for await (const doc of scheme.ModelTasks.find({serverName})) {
      await this.request({
        serverName,
        body  : doc.body,
        option: doc.option
      })
      await scheme.ModelTasks.deleteOne({_id: doc._id}).exec();
    }

    await wait(30000);
    await this.tasksLoad(serverName);
  }

  /**
   * Отправить запрос на unix сервер
   * @param {string} serverName - адрес unix сервера
   * @param {object} body - данные запроса
   * @param option
   * @param {boolean} option.db - сохранять запрос в базу или нет если unix сервер не доступен
   * @param {number} option.timeout - максимальное время выполнения запроса 120000 милисекунд
   * @param {function} cb
   * @returns {Promise<*>}
   */
  async request({serverName, body, option = {}}, cb = () => {}) {
    return new Promise(function (resolve) {

      if (option.timeout === undefined) option.timeout = 120000;

      let timeout = null;

      const client = net.createConnection({path: __dirname + '/sockets/' + serverName}, () => {
        client.write(JSON.stringify(body) + '\r\n');
        timeout = setTimeout(function () {
          client.end();
          const r = {
            error: {
              code: 'serverDisconnectTimeout',
              msg : 'Коннект закрыт по таймауту',
              d   : {serverName, body, option}
            }
          }
          resolve(r);
          cb(r);
        }, option.timeout)
      });

      client.on('data', (data) => {

        if (data===undefined){
          clearTimeout(timeout);
          console.error('В ответе на запрос в юниксокет ничего нет');
          const r = {msg: 'В ответе на запрос в юниксокет ничего нет'}
          resolve(r);
          cb(r);
          client.end();
          return;
        }

        clearTimeout(timeout);
        data    = data.toString();
        const r = JSON.parse(data)
        resolve(r);
        cb(r);
        client.end();
      });

      client.on('end', () => {
        //console.log('end')
      });

      client.on('error', (e) => {
        clearTimeout(timeout);
        console.error(e);

        if (option.db === true) {
          new scheme.ModelTasks({serverName, body, option}).save();
          const r = {
            error: {
              code: 'serverDisconnectDBSave',
              msg : 'Ошибка конекта. Данные сохранены в базу',
              e
            }
          }
          cb(r);
          return resolve(r);
        }

        const r = {
          error: {
            code: 'serverDisconnect',
            msg : 'Ошибка конекта',
            e
          }
        }
        cb(r);
        resolve(r);
      });
    })
  }

}

const clsUnixSocket = new UnixSocket();
module.exports      = clsUnixSocket;