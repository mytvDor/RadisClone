const net = require('net');
const Parser = require('redis-parser');

const store = {};
const subscribers = {};

const server = net.createServer(connection => {
  console.log('Client connected...');

  const parser = new Parser({
    returnReply: (reply) => {
      const command = reply[0]?.toLowerCase();
      const key = reply[1]; 
      const value = reply[2]; 

      switch (command) {
        case 'set':
          handleSet(key, value, connection);
          break;

        case 'get':
          handleGet(key, connection);
          break;

        case 'del':
          handleDel(key, connection);
          break;

        case 'publish':
          handlePublish(key, value, connection);
          break;

        case 'subscribe':
          handleSubscribe(key, connection);
          break;

        case 'expire':
          handleExpire(key, value, connection);
          break;

        default:
          connection.write('-ERR unknown command\r\n'); 
      }
    },
    returnError: (err) => {
      console.error('Parser error:', err);
      connection.write(`-ERR ${err.message}\r\n`); 
    }
  });

  connection.on('data', data => {
    try {
      parser.execute(data); 
    } catch (err) {
      console.error('Error handling data:', err);
      connection.write(`-ERR ${err.message}\r\n`); 
    }
  });

  connection.on('end', () => {
    console.log('Client disconnected');
  });

  connection.on('error', (err) => {
    console.error('Connection error:', err.message);
  });
});

function handleSet(key, value, connection) {
  if (key && value) {
    store[key] = { value, expiresAt: null }; 
    connection.write('+OK\r\n'); 
  } else {
    connection.write('-ERR wrong number of arguments for \'set\' command\r\n');
  }
}

function handleGet(key, connection) {
  if (key) {
    const item = store[key];
    if (!item) {
      connection.write('$-1\r\n');
    } else {
      if (item.expiresAt && item.expiresAt < Date.now()) {
        delete store[key]; 
        connection.write('$-1\r\n'); 
      } else {
        connection.write(`$${item.value.length}\r\n${item.value}\r\n`);
      }
    }
  } else {
    connection.write('-ERR wrong number of arguments for \'get\' command\r\n');
  }
}

function handleDel(key, connection) {
  if (key) {
    const deleted = delete store[key];
    connection.write(deleted ? ':1\r\n' : ':0\r\n'); 
  } else {
    connection.write('-ERR wrong number of arguments for \'del\' command\r\n');
  }
}

function handlePublish(channel, message, connection) {
  if (channel && message) {
    const clients = subscribers[channel] || [];
    clients.forEach(subscriber => {
      subscriber.write(`Message from ${channel}: ${message}\r\n`);
    });
    connection.write(':1\r\n'); 
  } else {
    connection.write('-ERR wrong number of arguments for \'publish\' command\r\n');
  }
}

function handleSubscribe(channel, connection) {
  if (channel) {
    if (!subscribers[channel]) {
      subscribers[channel] = [];
    }
    subscribers[channel].push(connection);
    connection.write(`+Subscribed to ${channel}\r\n`);
  } else {
    connection.write('-ERR wrong number of arguments for \'subscribe\' command\r\n');
  }
}

function handleExpire(key, seconds, connection) {
  if (key && seconds) {
    const item = store[key];
    if (!item) {
      connection.write('$-1\r\n'); 
    } else {
      item.expiresAt = Date.now() + parseInt(seconds, 10) * 1000; 
      connection.write(':1\r\n'); 
    }
  } else {
    connection.write('-ERR wrong number of arguments for \'expire\' command\r\n');
  }
}

server.listen(8000, () => {
  console.log('Custom Redis server running on port 8000');
});

//docker build -t redis-clone .
//docker run -d -p 8000:8000 --name redis-clone-container redis-clone
// docker start redis-clone-container
// docker stop redis-clone-container

//run commands
//node index.js
//-
//-
//on cmd
//redis-cli -p 8000
//set name sumit
