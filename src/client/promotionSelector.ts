import { handleContextMenuEvent, handleMouseMoveEvent, handleMouseUpEvent, handleTouchMoveEvent } from './gameLogic.js';
import { pitch, flip, ctx, canvas, piecesImg, lineSpace, getXY } from './drawBoard.js'
import { PieceType, PieceColor } from "../shared/types.js";


const promoPadding = 8;
const promoPieceSize = pitch - 2 * promoPadding;
const promoPiecesOrder = [PieceType.QUEEN, PieceType.ROOK, PieceType.BISHOP, PieceType.KNIGHT];
const promoBoxWidth = pitch - 2 * promoPadding;
const promoBoxHeight = 4 * pitch - 2 * promoPadding;
const promoDy = promoPieceSize + promoPadding;
const promoBackground = "#d2b08c";
let promoX = 0;
let promoY = 0;
export function drawPromotionSelector(unflippedRow: number, unflippedCol: number) {
    const color = unflippedRow === 0 ? PieceColor.BLACK : PieceColor.WHITE
    const {x, y} = getXY(unflippedRow, unflippedCol, flip);
    promoX = x;
    promoY = y;

    const direction = (unflippedRow === 0 && !flip || unflippedRow === 7 && flip) ? -1 : 1
    
    // Draw background box
    ctx.fillStyle = promoBackground;
    ctx.strokeStyle = '#000000';
    if (direction === 1) {
        ctx.fillRect(promoX + promoPadding, promoY + promoPadding, promoBoxWidth, promoBoxHeight);
        ctx.strokeRect(promoX + promoPadding, promoY + promoPadding, promoBoxWidth, promoBoxHeight);
    } else {
        ctx.fillRect(promoX + promoPadding, promoY + pitch - promoPadding, promoBoxWidth, -promoBoxHeight);
        ctx.strokeRect(promoX + promoPadding, promoY + pitch - promoPadding, promoBoxWidth, -promoBoxHeight);
    }
    
    // Draw each promotion option
    promoPiecesOrder.forEach((pieceType, idx) => {
        const promoYi = promoY + promoPadding + direction * idx * pitch;
        
        // this relies on the piece.type and piece.color enums being ordered to match the svg
        ctx.drawImage(piecesImg, 45*pieceType, 45*color, 45, 45, promoX + promoPadding, promoYi, promoPieceSize, promoPieceSize);
    });
}


export function waitForPromo(): Promise<PieceType> {
    return new Promise(resolve => {
        // Handle click on the promotion selector
        function handleClickPromotion(event: MouseEvent): void {
            canvas.removeEventListener('mouseup', handleClickPromotion);
            canvas.addEventListener('mouseup', handleMouseUpEvent);

            canvas.addEventListener('mousemove', handleMouseMoveEvent);
            canvas.addEventListener('contextmenu', handleContextMenuEvent);
            canvas.addEventListener('touchmove', handleTouchMoveEvent);

            const top = promoY !== lineSpace;
            
            // Check if click is within the selector box
            if (event.offsetX < promoX || event.offsetX > promoX + pitch
                || ( top && (event.offsetY > (promoY + pitch) || event.offsetY < promoY - 3 * pitch))
                || (!top && (event.offsetY < promoY || event.offsetY > promoY + 4 * pitch))) {
                // clicked outside of box: return empty
                resolve(PieceType.EMPTY);
            } else {
                if (top) resolve(promoPiecesOrder[Math.floor((promoY + pitch - event.offsetY) / pitch)]);
                else resolve(promoPiecesOrder[Math.floor((event.offsetY - promoY) / promoDy)]);
            }
            
        }

        canvas.removeEventListener('mouseup', handleMouseUpEvent);
        canvas.addEventListener('mouseup', handleClickPromotion);

        canvas.removeEventListener('mousemove', handleMouseMoveEvent);
        canvas.removeEventListener('contextmenu', handleContextMenuEvent);
        canvas.removeEventListener('touchmove', handleTouchMoveEvent);
        
    });
}