import { Pool, PoolClient, QueryArrayResult } from 'pg';
import { Game } from './gameLogic.js'
import { GameInfo, PieceColor } from '../shared/types.js';


const pool = new Pool({ ssl: { rejectUnauthorized: false } });
const table = process.env.DUMMY ? 'games_dummy' : 'games';

async function query(text: string, params: any): Promise<QueryArrayResult | undefined> {
  const start = Date.now()
  let res: QueryArrayResult;
  const showParams = process.env.DUMMY ? params : {}
  try {
    res = await pool.query(text, params);
  } catch (err) {
    console.log('Failed to execute query', { text, showParams })
    console.log(err);
    return;
  }
  const duration = Date.now() - start
  console.log('Successfully executed query', { text, showParams, duration, rows: res.rowCount })
  return res
}
 
async function getClient(): Promise<PoolClient> {
  return pool.connect()
}

async function testConnection(): Promise<void> {
    const res = await query('SELECT NOW();', []);
    console.log(res)
}    

// ['password', 'white', 'black', 'chat_log', 'moves_log', 'whites_turn', 'initial_time_white', 'initial_time_black', 'increment_white', 'increment_black', 'time_left_white', 'time_left_black', 'rules', 'result', 'cause', 'is_active', 'arrayfen', 'use_time_control'];
export async function saveToDB(game: Game): Promise<QueryArrayResult | undefined> {
    const {colNames, vals} = game.getDBStr();
    const valsPlaceholders = vals.map((_, i) => `$${i + 1}`);
    try {
        const res = await query(`UPDATE ${table} SET (${colNames.join(', ')}) = (${valsPlaceholders.join(', ')}) WHERE id = $${valsPlaceholders.length + 1};`, [...vals, game.id]);
        return res;
    } catch (err) {
        console.log(err);
    }
}

export async function gameFromDB(gameId: number): Promise<Game | undefined> {
    const db_rows: any = await query(`SELECT * FROM ${table} WHERE id = $1;`, [gameId]);
    const db_row = db_rows.rows[0];
    if (!db_row) return;

    const game = new Game(db_row.id, false, 0, 0, '');
    game.loadFromDB(db_row);
    return game;
}

const infoColumns = ['password', 'id', 'white', 'black', 'time_left_white', 'time_left_black', 'creation_timestamp',
                     'cause', 'is_active', 'use_time_control', 'whites_turn'].join(', ');
export async function gamesListFromDB(): Promise<GameInfo[] | undefined> {
    const games = await query(`SELECT ${infoColumns} FROM ${table};`, []);
    if (!games) return;

    const gameList: GameInfo[] = [];
    for (let i = 0; i < games.rows.length; i++) {
        const game = games.rows[i] as any;
        gameList.push({
            hasPassword: game.password !== '', 
            gameId: game.id,
            playerWhite: game.white,
            playerBlack: game.black,
            lastNameWhite: game.white,
            lastNameBlack: game.black,
            numberOfSpectators: 0,
            timeLeftWhite: game.time_left_white,
            timeLeftBlack: game.time_left_black,
            creationTime: new Date(game.creation_timestamp).getTime(),
            result: game.cause,
            isActive: game.is_active,
            useTimeControl: game.use_time_control,
            currentTurn: game.whites_turn ? PieceColor.WHITE : PieceColor.BLACK,
        });
    }
    return gameList;
}

async function hasGame(gameId: number): Promise<boolean> {
    const res = await query(`SELECT EXISTS(SELECT 1 FROM ${table} WHERE id=$1)`, [gameId]);

    return res !== undefined && (res?.rows[0] as any).exists;
}

export async function storeNewGame(): Promise<number | undefined> {
    const res: any = await query(`INSERT INTO ${table} DEFAULT VALUES RETURNING id;`, []);
    if (!res) return;
    
    return res.rows[0].id;
}

export async function storeNewGameWithId(gameId: number): Promise<number | undefined> {
    // create a new game, update its ID, then set the sequence to be above the specified ID (if required)

    if (await hasGame(gameId)) {
        console.log(`Cannot create new game with ID ${gameId} because it already exists!`);
        return;
    }

    const gameIdToReplace = await storeNewGame();
    if (!gameIdToReplace) return;

    await query(`UPDATE ${table} SET id=$1 WHERE id=$2`, [gameId, gameIdToReplace]);
    
    // set the sequence value to be above gameId
    if (gameIdToReplace < gameId) {
        await query(`alter sequence ${table}_id_seq restart with ${gameId+1}`, []);
    }

    return gameId;
}

export async function createDummyTable(): Promise<void> {
    const client = await getClient();
    // make table with same columns and data
    await client.query('DROP TABLE IF EXISTS games_dummy;', []);
    await client.query('CREATE TABLE games_dummy AS SELECT * FROM games;', []);

    // add auto-incrementing primary key onto id with next val of max(id)
    await client.query('DROP SEQUENCE IF EXISTS games_dummy_id_seq;', []);
    await client.query('CREATE SEQUENCE games_dummy_id_seq;', []);
    await client.query('ALTER TABLE games_dummy ALTER COLUMN id SET DEFAULT nextval(\'games_dummy_id_seq\');', []);
    await client.query('ALTER TABLE games_dummy ADD PRIMARY KEY (id);', []);
    await client.query('ALTER SEQUENCE games_dummy_id_seq OWNED BY games_dummy.id;', []);
    await client.query(`SELECT setval(\'games_dummy_id_seq\', (SELECT MAX(id) FROM games_dummy));`, []);

    // add timestamp default
    await client.query('ALTER TABLE games_dummy ALTER COLUMN creation_timestamp SET DEFAULT CURRENT_TIMESTAMP;', []);
    await client.query('ALTER TABLE games_dummy ALTER COLUMN creation_timestamp SET NOT NULL;', []);
    client.release();
}