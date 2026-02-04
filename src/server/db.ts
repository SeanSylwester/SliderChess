import { Pool, Client, PoolClient, QueryArrayResult, QueryResult } from 'pg';
import { Game } from './gameLogic.js'


const pool = new Pool({ ssl: { rejectUnauthorized: false } });
const table = process.env.LOCAL ? 'games_dummy' : 'games';

export async function query(text: string, params: any): Promise<QueryArrayResult> {
  const start = Date.now()
  const res = await pool.query(text, params)
  const duration = Date.now() - start
  console.log('executed query', { text, duration, rows: res.rowCount })
  return res
}
 
export async function getClient(): Promise<PoolClient> {
  return pool.connect()
}

export async function testConnection(): Promise<void> {
    try {
        const res = await query('SELECT NOW();', []);
        console.log(1, res)
    } catch (err) {
        console.error(err);
    }
}
    

const cols = ['password', 'white', 'black', 'chat_log', 'moves_log', 'whites_turn', 'initial_time_white', 'initial_time_black', 'increment_white', 'increment_black', 'time_left_white', 'time_left_black', 'rules', 'result', 'cause', 'is_active'];
export async function saveToDB(game: Game): Promise<QueryArrayResult | undefined> {
    const colEqVal = game.getDBStr();
    try {
        const res = await query(`UPDATE ${table} SET ${colEqVal} WHERE id = ${game.id};`, []);
        return res;
    } catch (err) {
        console.log(err);
    }
}

export async function gameFromDB(gameId: number): Promise<QueryResult | undefined> {
    try {
        const res = await query(`SELECT * FROM ${table} WHERE id = ${gameId};`, []);
        return res;
    } catch (err) {
        console.log(err);
    }
}

export async function gamesFromDB(): Promise<QueryArrayResult | undefined> {
    try {
        const res = await query(`SELECT * FROM ${table};`, []);
        return res;
    } catch (err) {
        console.log(err);
    }
}

export async function storeNewGame(): Promise<number | undefined> {
    try {
        const res: any = await query(`INSERT INTO ${table} DEFAULT VALUES RETURNING id;`, []);
        return res.rows[0].id;
    } catch (err) {
        console.log(err);
    }
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