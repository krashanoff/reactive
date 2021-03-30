//
// Wrapper for our database operations.
//

const { MongoClient } = require("mongodb");

const URI = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PW}@${process.env.CLUSTER_URL}/${process.env.DB_NAME}?retryWrites=true&w=majority`;
const DB = process.env.NODE_ENV === "production" ? "prod" : "test";

/**
 * Wraps a transaction on our database in a connection handler.
 *
 * @param {(db: Database) => Promise<any>} tx Transaction to run on the database.
 * @returns {any} Whatever tx returns.
 */
async function transaction(tx) {
  const client = new MongoClient(URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  return new Promise((res, rej) => {
    client.connect(async err => {
      if (err) throw err;
      const db = client.db(DB);
      try {
        res(await tx(db));
      } catch (err) {
        rej(err);
      }
    });
  });
}

/**
 * Check if a message has been posted to a board.
 * 
 * @param {String} id ID of the message to check.
 * @returns {Boolean} If the message with given ID has been posted to a server's board.
 */
const onBoard = id =>
  transaction(async db => (
    !!(await db
      .collection("messages")
      .findOne(
        { id }
      )
    )
  ));

/**
 * Get the reaction minimum for a server. If one is not set,
 * defaults to 3.
 * 
 * @param {String} id ID of the server to get.
 * @returns {Number} Minimum number of reactions required to land a message on the board.
 */
const getReactionMin = id =>
  transaction(async db => (
    (await db
      .collection("servers")
      .findOne(
        { id }
      )
    )?.reactMin || 3
  ));

/**
 * Set a new reaction minimum for some server. Creates the server
 * document if it does not yet exist.
 * 
 * @param {String} id ID of the server to create/modify.
 * @param {Number} newMin New minimum number of reactions required.
 */
const setReactionMin = (id, newMin) =>
  transaction(async db => {
    await db
      .collection("servers")
      .updateOne(
        { id },
        { $set: { reactMin: newMin } },
        { upsert: true },
      );
  });

/**
 * Get the ID of the channel to forward highly-reacted messages to.
 * 
 * @param {String} id ID of the server to get.
 * @returns {String} ID of the channel to forward to.
 */
const getFwdChan = id =>
  transaction(async db => (
    (await db
      .collection("servers")
      .findOne(
        { id },
      )
    )?.fwdChan
  ));

/**
 * Set a new forwarding channel for some server. Creates the server
 * document if it does not yet exist.
 * 
 * @param {String} id ID of the server to create/modify.
 * @param {String} newChanID Channel to forward "superpins" to.
 */
const setFwdChan = (id, newChanID) =>
  transaction(async db => {
    await db
      .collection("servers")
      .updateOne(
        { id },
        { $set: { fwdChan: newChanID } },
        { upsert: true },
      );
  });

module.exports = {
  onBoard,
  getReactionMin,
  setReactionMin,
  getFwdChan,
  setFwdChan,
};
