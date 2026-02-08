import { Piece, PieceType } from "../shared/types.js";
import { col0ToFile } from "../shared/utils.js";
import { chatLogElement, movesLogElement, localGameState } from "./gameLogic.js";
import { updateTimeDisplay } from "./timer.js";

// init canvas
export const canvas = document.getElementById("board") as HTMLCanvasElement;
export const ctx = canvas.getContext("2d")!;
const font = '24px Arial';
ctx.font = font;
ctx.lineWidth = 2;
(window as any).ctx = ctx;

const sampleText = ctx.measureText('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz');
const textHeight = sampleText.actualBoundingBoxAscent + sampleText.actualBoundingBoxDescent;

// drawing the board
export let flip = false;
const highlightSpace = 2;
export const lineSpace = 1;
const textSpace = 20;
const textMargin = 4;
const boardWidthMax = 1000;
let boardSize = canvas.width - textSpace;
export let pitch = Math.floor(boardSize / 8); // size of each square
const tilePct = 0.2; // percentage of the square on each side for selecting a tile instead
export const piecesImg = document.getElementById("piecesSpriteSheet") as HTMLImageElement;
const fillStyles = ["#f0d9b5", "#b58863"]; // light and dark squares

export function getBoardRowCol(offsetX: number, offsetY: number): {uRow: number, uCol: number} {
    let uCol: number;
    let uRow: number;
    //console.log(`Clicked on row ${Math.floor(event.offsetY / pitch)}, col ${Math.floor((event.offsetX - textSpace) / pitch)}`);
    // transmute to unflipped row/col index, which matches the board[row][col]
    if (flip) {
        uCol = 7 - Math.floor((offsetX - textSpace) / pitch);
        uRow = Math.floor((offsetY - lineSpace) / pitch);
    } else {
        uCol = Math.floor((offsetX - textSpace) / pitch);
        uRow = 7 - Math.floor((offsetY - lineSpace) / pitch);
    }

    return {uRow, uCol};
}
export function checkIfTile(offsetX: number, offsetY: number): boolean {
    const xSquareOffset = (offsetX - textSpace) % pitch;
    const ySquareOffset = (offsetY - 1) % pitch;
    return (xSquareOffset < pitch*tilePct || xSquareOffset > pitch*(1-tilePct)) && (ySquareOffset < pitch*tilePct || ySquareOffset > pitch*(1-tilePct));
}


export function setFlip(doFlip: boolean): void {
    flip = doFlip;
}
function setVeritcal(isVertical: boolean): void {
    if (isVertical) {
        chatLogElement.cols = 35;
        (document.getElementById('chatEntry') as HTMLInputElement).size = 32;
    } else {
        chatLogElement.cols = 70;
        (document.getElementById('chatEntry') as HTMLInputElement).size = 67;
    }
}
export function updateBoardDimensions(): void {
    const movesLogWidth = parseInt(movesLogElement.style.width.slice(0, -2)) + 20;  // slice off the "px"
    const padding = 50;  // not sure how to calculate the padding and stuff around all the elements
    const chatButtons = 400;  

    // TODO: make notation box fit better in vertical
    movesLogElement.style.width = "215px";

    const vertical = window.innerHeight > window.innerWidth * 1.5;

    if (vertical) {
        setVeritcal(true);
        const windowX = window.visualViewport!.width - padding; 
        const windowY = window.visualViewport!.height - padding;

        boardSize = Math.min(boardWidthMax, Math.min(windowX, windowY));
        pitch = Math.floor(boardSize / 8); // size of each square
        boardSize = pitch * 8;
        canvas.width = boardSize + textSpace;
        canvas.height = boardSize + 1.5*textHeight + textMargin + lineSpace;

        movesLogElement.style.marginBottom = '0px';
        movesLogElement.style.height = `${canvas.height / 4}px`;
        ctx.font = font;
    } else {
        setVeritcal(false);
        const windowX = window.innerWidth - movesLogWidth - padding; 
        const windowY = window.innerHeight - chatButtons - padding;

        boardSize = Math.min(boardWidthMax, Math.min(windowX, windowY));
        pitch = Math.floor(boardSize / 8); // size of each square
        boardSize = pitch * 8;
        canvas.width = boardSize + textSpace;
        canvas.height = boardSize + 1.5*textHeight + textMargin + lineSpace;

        movesLogElement.style.marginBottom = `${1.5*textHeight + textMargin - 2}px`;
        movesLogElement.style.height = `${boardSize - 2}px`;
        ctx.font = font;
    }
    if (!canvas.width) setTimeout(updateBoardDimensions, 100);
    renderFullBoard();
}
window.addEventListener('resize', updateBoardDimensions);
//window.visualViewport?.addEventListener('resize', updateBoardDimensions);
export function flipBoard(): void {
    flip = !flip;
    renderFullBoard();
    highlightLastMove();
    updateTimeDisplay();
}
export function getXY(unflippedRow: number, unflippedCol: number, isFlip: boolean): {x: number, y: number} {
    // in the flipped view, the columns are reversed because file h is at x=0
    // in the regular view, the rows are reversed because rank 8 is at y=0
    const {row, col} = getFlippedRowCol(unflippedRow, unflippedCol, isFlip);
    return {x: col * pitch + textSpace,
            y: row * pitch + lineSpace}
}

function getFlippedRowCol(unflippedRow: number, unflippedCol: number, isFlip: boolean): {row: number, col: number} {
    // in the flipped view, the columns are reversed because file h is at x=0
    // in the regular view, the rows are reversed because rank 8 is at y=0
    return {col: (isFlip ? 7 - unflippedCol : unflippedCol),
            row: (isFlip ? unflippedRow : 7 - unflippedRow)}
}

export function renderFullBoard(): void {
    if (!localGameState) {
        console.error("No game state to render");
        return;
    }
    // clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // draw the background
    drawAllBackgroundSquares();

    // draw pieces, bottom to top (rank 1-8), left to right (file a-h)
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            drawPieceRowCol(row, col, localGameState.board[row][col])
        }
    }

    // draw text around edges
    ctx.fillStyle = "black";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let row = 0; row < 8; row++) {
        ctx.fillText((flip ? row+1 : 8-row).toString(), textSpace - textMargin, lineSpace + row * pitch + pitch/2);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let col = 0; col < 8; col++) {
        // 97 is 'a'
        ctx.fillText(col0ToFile(flip ? 7-col: col), col * pitch + pitch/2 + textSpace, boardSize + lineSpace + textMargin);
    }

    // draw tile borders
    drawAllTileBorders();

    ctx.stroke();
}

function drawPieceXY(x: number, y: number, piece: Piece): void {
    if (piece.type !== PieceType.EMPTY) {
        // this relies on the piece.type and piece.color enums being ordered to match the svg
        ctx.drawImage(piecesImg, 45*piece.type, 45*piece.color, 45, 45, x, y, pitch, pitch);
    }
}

function drawPieceRowCol(unflippedRow: number, unflippedCol: number, piece: Piece): void {
    if (piece.type !== PieceType.EMPTY) {
        const {x, y} = getXY(unflippedRow, unflippedCol, flip);
        drawPieceXY(x, y, piece);
    }
}

function drawAllBackgroundSquares(): void {
    let x: number;
    let y: number;

    function drawSquaresQuarter(startRow: number, startCol: number): void {
        for (let row = startRow; row < 8; row += 2) {
            for (let col = startCol; col < 8; col += 2) {
                x = col * pitch + textSpace;
                y = row * pitch + lineSpace;
                ctx.fillRect(x, y, pitch, pitch);
            }
        }
    }

    // light squares
    ctx.fillStyle = fillStyles[0];
    drawSquaresQuarter(0, 0);
    drawSquaresQuarter(1, 1);

    // dark squares
    ctx.fillStyle = fillStyles[1];
    drawSquaresQuarter(0, 1);
    drawSquaresQuarter(1, 0);
}

function drawAllTileBorders(): void {
    ctx.strokeStyle = '#000000';
    for (let row = 0; row < 8; row+=2) {
        for (let col = 0; col < 8; col+=2) {
            drawTileBorder(row, col);
        }
    }
}
function drawTileBorder(unflippedRow: number, unflippedCol: number): void {
    let {row, col} = getFlippedRowCol(unflippedRow, unflippedCol, flip);
    ctx.strokeStyle = '#000000';
    row -= row % 2;
    col -= col % 2;

    const x = col * pitch + textSpace;
    const y = row * pitch + lineSpace;
    ctx.strokeRect(x, y, 2*pitch, 2*pitch);
}

export function drawSquare(unflippedRow: number, unflippedCol: number, isTile: boolean, piece: Piece | null | Piece[], alpha=1): void {  
    //console.log(`(${row}, ${col}), ${isTile}, ${piece}`);
    if (isTile) {
        // force index to the bottom left corner
        unflippedRow -= unflippedRow % 2;
        unflippedCol -= unflippedCol % 2;

        if (Array.isArray(piece)) {
            drawSquare(unflippedRow, unflippedCol, false, piece[0], alpha);
            drawSquare(unflippedRow+1, unflippedCol, false, piece[1], alpha);
            drawSquare(unflippedRow+1, unflippedCol+1, false, piece[2], alpha);
            drawSquare(unflippedRow, unflippedCol+1, false, piece[3], alpha);
        } else {
            drawSquare(unflippedRow, unflippedCol, false, null, alpha);
            drawSquare(unflippedRow+1, unflippedCol, false, null, alpha);
            drawSquare(unflippedRow+1, unflippedCol+1, false, null, alpha);
            drawSquare(unflippedRow, unflippedCol+1, false, null, alpha);
        }
    } else {
        // x and y point to the top left corner of the square (flipped or not)
        const {x, y} = getXY(unflippedRow, unflippedCol, flip);

        // draw square background
        ctx.fillStyle = fillStyles[1 - (unflippedRow + unflippedCol) % 2];
        ctx.fillRect(x, y, pitch, pitch);

        // grab piece from the board, or use the argument
        if (!piece && localGameState) {
            piece = localGameState.board[unflippedRow][unflippedCol];
        }

        // draw piece (if we found one)
        if (piece && !Array.isArray(piece)) {
            const prevAlpha = ctx.globalAlpha;
            ctx.globalAlpha = alpha;
            drawPieceXY(x, y, piece);
            ctx.globalAlpha = prevAlpha;
        }

        // redraw tile border
        drawTileBorder(unflippedRow, unflippedCol);
    }
}

export function highlightSquare(unflippedRow: number, unflippedCol: number, style: string, isTile: boolean): void {
    let {row, col} = getFlippedRowCol(unflippedRow, unflippedCol, flip);
    if (isTile) {
        // force draw index to the top left corner
        row -= row % 2;
        col -= col % 2;   
    } 

    ctx.strokeStyle = style;
    ctx.strokeRect(col * pitch + textSpace + ctx.lineWidth/2 + highlightSpace, 
                   row * pitch + ctx.lineWidth/2 + highlightSpace + lineSpace, 
                   (isTile ? 2 : 1)*pitch - ctx.lineWidth - 2*highlightSpace, 
                   (isTile ? 2 : 1)*pitch - ctx.lineWidth - 2*highlightSpace);
}

export function highlightLastMove(): void {
    if (!localGameState || localGameState.movesLog.length === 0) {
        return;
    }
    
    const localLastMove = localGameState.movesLog.at(-1)!;
    highlightSquare(localLastMove.fromRow, localLastMove.fromCol, "rgb(0 255 0 / 25%)", localLastMove.isTile);
    highlightSquare(localLastMove.toRow, localLastMove.toCol, "rgb(0 255 0 / 75%)", localLastMove.isTile);
    if (localLastMove.isTile) {
        highlightSquare(localLastMove.fromRow, localLastMove.fromCol, "rgb(0 255 0 / 25%)", false);
        highlightSquare(localLastMove.toRow, localLastMove.toCol, "rgb(0 255 0 / 75%)", false);
    }
}

export function clearLastMoveHighlight(): void {
    if (!localGameState || localGameState.movesLog.length === 0) {
        return;
    }
    const localLastMove = localGameState.movesLog.at(-1)!;
    drawSquare(localLastMove.fromRow, localLastMove.fromCol, localLastMove.isTile, null);
    drawSquare(localLastMove.toRow, localLastMove.toCol, localLastMove.isTile, null);
}