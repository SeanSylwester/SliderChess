import { Pool, Client, PoolClient, QueryArrayResult, QueryResult } from 'pg';
import { Game } from './gameLogic.js'
import { GameInfo, PieceColor } from '../shared/types.js';


const pool = new Pool({ ssl: { rejectUnauthorized: false } });
const table = process.env.DUMMY ? 'games_dummy' : 'games';

export async function query(text: string, params: any): Promise<QueryArrayResult | undefined> {
  const start = Date.now()
  let res: QueryArrayResult;
  try {
    res = await pool.query(text, params);
  } catch (err) {
    console.log(err);
    return;
  }
  const duration = Date.now() - start
  console.log('executed query', { text, duration, rows: res.rowCount })
  return res
}
 
export async function getClient(): Promise<PoolClient> {
  return pool.connect()
}

export async function testConnection(): Promise<void> {
    const res = await query('SELECT NOW();', []);
    console.log(res)
}

export async function close(): Promise<void> {
    await pool.end();
    console.log('Database closed');
}
    

// ['password', 'white', 'black', 'chat_log', 'moves_log', 'whites_turn', 'initial_time_white', 'initial_time_black', 'increment_white', 'increment_black', 'time_left_white', 'time_left_black', 'rules', 'result', 'cause', 'is_active', 'arrayfen', 'use_time_control'];
export async function saveToDB(game: Game): Promise<QueryArrayResult | undefined> {
    const colEqVal = game.getDBStr();
    try {
        const res = await query(`UPDATE ${table} SET ${colEqVal} WHERE id = ${game.id};`, []);
        return res;
    } catch (err) {
        console.log(err);
    }
}

export async function gameFromDB(gameId: number): Promise<Game | undefined> {
    const db_rows: any = await query(`SELECT * FROM ${table} WHERE id = ${gameId};`, []);
    const db_row = db_rows.rows[0];
    if (!db_row) return;

    const game = new Game(db_row.id, false, 0, 0, '');
    game.loadFromDB(db_row);
    return game;
}

export async function gamesFromDB(): Promise<QueryArrayResult | undefined> {
    return await query(`SELECT * FROM ${table};`, []);
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

export async function storeNewGame(): Promise<number | undefined> {
    const res: any = await query(`INSERT INTO ${table} DEFAULT VALUES RETURNING id;`, []);
    if (!res) return;
    
    return res.rows[0].id;
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