// http://devernay.free.fr/hacks/chip8/C8TECH10.HTM#8xyE

///////////////////////////////////////////////////////////
//////////////////// Basic Structures /////////////////////
///////////////////////////////////////////////////////////

const MEMOFFSET = 0x200;
const MEM = new Uint8Array(4096);
// 16 registers, 8 bit each
// V[0x0] - V[0xF]
const V = new Uint8Array(16);
// Stack is 16bit, with 16 levels
const STACK = new Uint16Array(16);
// stack pointer
var SP = 0x0;
// instruction pointer
var I = 0x0;
// program counter
var PC = 0x0;
// timers
var DT = 0; // delay timer
var ST = 0; // sound timer
// fonts
const fontSet = [
    0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
    0x20, 0x60, 0x20, 0x20, 0x70, // 1
    0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
    0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
    0x90, 0x90, 0xF0, 0x10, 0x10, // 4
    0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
    0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
    0xF0, 0x10, 0x20, 0x40, 0x40, // 7
    0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
    0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
    0xF0, 0x90, 0xF0, 0x90, 0x90, // A
    0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
    0xF0, 0x80, 0x80, 0x80, 0xF0, // C
    0xE0, 0x90, 0x90, 0x90, 0xE0, // D
    0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
    0xF0, 0x80, 0xF0, 0x80, 0x80, // F
];
// Display 64x32
const scale = 10;
const res_x = 64, res_y = 32;
const bitmap = new Uint8Array(res_x * res_y);
// create canvas
const canvas = document.createElement("canvas");
document.body.appendChild(canvas);
canvas.setAttribute("width", res_x * scale);
canvas.setAttribute("height", res_y * scale);
const ctx = canvas.getContext("2d");
// scale the canvas
ctx.scale(scale, scale);
// reset canvas
function clear_canvas() {
    for (let i = 0; i < bitmap.length; i++) {
        bitmap[i] = 0;
    }
    ctx.clearRect(0, 0, res_x * scale, res_y * scale);
}

// Handle keys
var key_state = {};
window.onkeyup = function (e) {
    console.log("key up", e.key, e.keyCode);

    if(e.keyCode >= 48 && e.keyCode <= 57) // 0-9
        key_state[e.keyCode - 48] = false;
    else if(e.keyCode >= 65) // a-z
        key_state[e.keyCode - 56] = false;
};
window.onkeydown = function (e) {
    console.log("key down", e.key, e.keyCode);

    if(e.keyCode >= 48 && e.keyCode <= 57) // 0-9
        key_state[e.keyCode - 48] = true;
    else if(e.keyCode >= 65) // a-z
        key_state[e.keyCode - 56] = true;
};
const get_key = () => {
    console.log("wait for key");
    return new Promise(resolve => window.addEventListener('keypress', resolve, {
        once: true
    }));
};

// rom file load handler
document.querySelector('input').addEventListener('change', function () {
    var reader = new FileReader();
    reader.onload = function () {
        reset();

        var arrayBuffer = this.result,
            array = new Uint8Array(arrayBuffer);

        load_in_memory(array, MEMOFFSET);
    }
    reader.readAsArrayBuffer(this.files[0]);
}, false);

function reset() {
    clear_canvas();
    MEM.fill(0);
    STACK.fill(0);
    V.fill(0);

    load_in_memory(fontSet, 0);
}

// load binary in memory, on offset 0x200
function load_in_memory(bin, offset) {
    for (let i = 0; i < bin.length; i++) {
        MEM[offset + i] = bin[i];
    }
}

async function main() {
    

    //load_in_memory(fishie_ch8);
    PC = MEMOFFSET;
    while (true) {
        await decode((MEM[PC] << 8) | MEM[PC + 1]);
        await sleep(100 / 60); // 60hz

        if (DT > 0) {
            DT--;
        }
        if (ST > 0) {
            if (ST === 1) {
                // beep
            }
            ST--;
        }
    }
}

// setTimeout.dt = 0;
// function selfAdjustingTimeout(callback, timeout, args) {
//     setTimeout.et = (new Date).getTime() + timeout;
//     let cb = () => {
//         setTimeout.dt = (new Date).getTime() - setTimeout.et;
//         console.log(setTimeout.dt);
//         callback();
//     };
//     setTimeout(cb, timeout - setTimeout.dt, args);
// }

async function sleep(ms) {
    // return new Promise(rs => selfAdjustingTimeout(rs, ms));
    return new Promise(rs => setTimeout(rs, ms));
}

async function decode(opcode /* 16 bit */ ) {
    let NNN = 0x0;
    let NN = 0x0;
    let X = 0x0;
    let Y = 0x0;
    // console.log("0x"+opcode.toString(16));
    switch (opcode & 0xF000) {
        case 0x0000:
            // 0NNN	Call		Calls RCA 1802 program at address NNN. Not necessary for most ROMs.
            // 00E0	Display	disp_clear()	Clears the screen.
            // 00EE	Flow	return;	Returns from a subroutine.
            switch (opcode & 0x00EF) {
                case 0x00E0:
                    // Display	disp_clear()	Clears the screen.
                    clear_canvas();
                    PC += 2;
                    break;
                case 0x00EE:
                    //Flow	return;	Returns from a subroutine.
                    SP -= 1;
                    PC = STACK[SP];
                    break;
            }
            break;
        case 0x1000:
            // 1NNN	Flow	goto NNN;	Jumps to address NNN.
            NNN = opcode & 0x0FFF;
            PC = NNN;
            break;
        case 0x2000:
            // 2NNN	Flow	*(0xNNN)()	Calls subroutine at NNN.
            NNN = opcode & 0x0FFF;
            STACK[SP] = PC + 2;
            SP += 1;
            PC = NNN;
            break;
        case 0x3000:
            // 3XNN	Cond	if(Vx!=NN)	Skips the next instruction if VX equals NN. (Usually the next instruction is a jump to skip a code block)
            NN = opcode & 0x00FF;
            X = (opcode & 0x0F00) >> 8;
            if (V[X] === NN) {
                PC += 2;
            }
            PC += 2;
            break;
        case 0x4000:
            // 4XNN	Cond	if(Vx==NN)	Skips the next instruction if VX doesn't equal NN. (Usually the next instruction is a jump to skip a code block)
            NN = opcode & 0x00FF;
            X = (opcode & 0x0F00) >> 8;
            if (V[X] != NN) {
                PC += 2;
            }
            PC += 2;
            break;
        case 0x5000:
            // 5XY0	Cond	if(Vx!=Vy)	Skips the next instruction if VX equals VY. (Usually the next instruction is a jump to skip a code block)
            X = (opcode & 0x0F00) >> 8;
            Y = (opcode & 0x00F0) >> 4;
            if (V[X] === V[Y]) {
                PC += 2;
            }
            PC += 2;
            break;
        case 0x6000:
            // 6XNN	Const	Vx = NN     Sets VX to NN.
            NN = opcode & 0x00FF;
            X = (opcode & 0x0F00) >> 8;
            V[X] = NN;
            PC += 2;
            break;
        case 0x7000:
            // 7XNN	Const	Vx += NN	Adds NN to VX. (Carry flag is not changed)
            NN = opcode & 0x00FF;
            X = (opcode & 0x0F00) >> 8;
            let sum = V[X] + NN;
            if (sum > 255) {
                sum -= 256;
            }
            V[X] = sum;
            PC += 2;
            break;
        case 0x8000:
            // 8XY0	Assign	Vx=Vy	Sets VX to the value of VY.
            // 8XY1	BitOp	Vx=Vx|Vy	Sets VX to VX or VY. (Bitwise OR operation)
            // 8XY2	BitOp	Vx=Vx&Vy	Sets VX to VX and VY. (Bitwise AND operation)
            // 8XY3	BitOp	Vx=Vx^Vy	Sets VX to VX xor VY.
            // 8XY4	Math	Vx += Vy	Adds VY to VX. VF is set to 1 when there's a carry, and to 0 when there isn't.
            // 8XY5	Math	Vx -= Vy	VY is subtracted from VX. VF is set to 0 when there's a borrow, and 1 when there isn't.
            // 8XY6	BitOp	Vx>> =1	Stores the least significant bit of VX in VF and then shifts VX to the right by 1.[2]
            // 8XY7	Math	Vx=Vy-Vx	Sets VX to VY minus VX. VF is set to 0 when there's a borrow, and 1 when there isn't.
            // 8XYE	BitOp	Vx<< =1	Stores the most significant bit of VX in VF and then shifts VX to the left by 1.[3]
            X = (opcode & 0x0F00) >> 8;
            Y = (opcode & 0x00F0) >> 4;
            switch (opcode & 0x000F) {
                case 0:
                    V[X] = V[Y];
                    break;
                case 1:
                    V[X] = V[X] | V[Y];
                    break;
                case 2:
                    V[X] = V[X] & V[Y];
                    break;
                case 3:
                    V[X] = V[X] ^ V[Y];
                    break;
                case 4:
                    // const s = V[X] + V[Y];
                    // V[X] = s & 0x00FF;
                    // V[0xF] = 0;
                    // if (s > 255) {
                    //     V[0xF] = 1;
                    // }

                    V[X] += V[Y];
                    V[0xF] = +(V[X] > 255);
                    if (V[X] > 255) {
                        V[X] -= 256;
                    }
                    break;
                case 5:
                    // if (V[X] < V[Y]) {
                    //     V[0xF] = 0;
                    // } else {
                    //     v[0xF] = 1;
                    // }
                    // V[X] = V[X] - V[Y];

                    V[0xF] = +(V[X] > V[Y]);
                    V[X] -= V[Y];
                    if (V[X] < 0) {
                        V[X] += 256;
                    }
                    break;
                case 6:
                    V[0xF] = V[X] & 1;
                    V[X] = V[X] >> 1;
                    break;
                case 7:
                    // if (V[X] > V[Y]) {
                    //     V[0xF] = 0;
                    // } else {
                    //     v[0xF] = 1;
                    // }
                    // V[X] = V[Y] - V[X];

                    V[0xF] = +(V[Y] > V[X]);
                    V[X] = V[Y] - V[X];
                    if (V[X] < 0) {
                        V[X] += 256;
                    }
                    break;
                case 0xE:
                    // V[0xF] = V[X] & 0x00F0;
                    // V[X] = V[X] << 1;

                    V[0xF] = +(V[X] & 0x80);
                    V[X] <<= 1;
                    if (V[X] > 255) {
                        V[X] -= 256;
                    }
                    break;
            }
            PC += 2;
            break;
        case 0x9000:
            // 9XY0	Cond	if(Vx==Vy)	Skips the next instruction if VX doesn't equal VY. (Usually the next instruction is a jump to skip a code block)
            X = (opcode & 0x0F00) >> 8;
            Y = (opcode & 0x00F0) >> 4;
            if (V[X] != V[Y]) {
                PC += 2;
            }
            PC += 2;
            break;
        case 0xA000:
            // ANNN	MEM	I = NNN	Sets I to the address NNN.
            NNN = opcode & 0x0FFF;
            I = NNN;
            PC += 2;
            break;
        case 0xB000:
            // BNNN	Flow	PC=V0+NNN	Jumps to the address NNN plus V0.
            NNN = opcode & 0x0FFF;
            PC = V[0] + NNN;
            break;
        case 0xC000:
            // CXNN	Rand	Vx=rand()&NN	Sets VX to the result of a bitwise and operation on a random number (Typically: 0 to 255) and NN.
            X = (opcode & 0x0F00) >> 8;
            NN = opcode & 0x00FF;
            V[X] = Math.floor(Math.random() * 0xff) & NN;
            PC += 2;
            break;
        case 0xD000:
            // DXYN	Disp	draw(Vx,Vy,N)	
            // Draws a sprite at coordinate (VX, VY) that has a width of 8 pixels and a height of N pixels. 
            // Each row of 8 pixels is read as bit-coded starting from memory location I; I value doesn’t change after the execution of this instruction. 
            // As described above, VF is set to 1 if any screen pixels are flipped from set to unset when the sprite is drawn, and to 0 if that doesn’t happen
            X = (opcode & 0x0F00) >> 8;
            Y = (opcode & 0x00F0) >> 4;

            const spr_height = N = opcode & 0x000F;
            const spr_width = 8;

            const x = V[X];
            const y = V[Y];

            // console.time("draw");
            let collision = false;
            for (let row = 0; row < spr_height; row++) {

                const spr_row = MEM[I + row];
                for (let b = 0; b < spr_width; b++) {
                    const xx = x + b;
                    const yy = y + row;

                    const bit = spr_row >> (7 - b) & 1;

                    const px_old = bitmap[xx + yy * res_x];
                    const px = px_old ^ bit;
                    bitmap[xx + yy * res_x] = px;

                    // draw the bit
                    if (px === 1) {
                        ctx.fillRect(xx, yy, 1, 1);
                    } else {
                        ctx.clearRect(xx, yy, 1, 1);
                    }

                    if (px_old === 1 && px === 0) {
                        collision = true;
                    }
                }
            }
            // console.timeEnd("draw");

            // draw full bitmap
            // for (let h = 0; h < res_y; h++) {
            //     for (let w = 0; w < res_x; w++) {
            //         if(bitmap[w + h * res_x] === 1){
            //             ctx.fillRect(w, h, 1, 1);
            //         } else {
            //             ctx.clearRect(w, h, 1, 1);
            //         }
            //     }
            // }

            if (collision) {
                V[0xF] = 1;
            } else {
                V[0xF] = 0;
            }

            PC += 2;
            break;
        case 0xE000:
            // EX9E	KeyOp	if(key()==Vx)	Skips the next instruction if the key stored in VX is pressed. (Usually the next instruction is a jump to skip a code block)
            // EXA1	KeyOp	if(key()!=Vx)	Skips the next instruction if the key stored in VX isn't pressed. (Usually the next instruction is a jump to skip a code block)
            X = (opcode & 0x0F00) >> 8;
            console.log("check key state", V[X], String.fromCharCode(V[X]));
            switch (opcode & 0x00FF) {
                case 0x009E:
                    if (key_state[V[X]] == true) {
                        PC += 2;
                    }
                    break;
                case 0x00A1:
                    if (key_state[V[X]] == false) {
                        PC += 2;
                    }
                    break;
            }
            PC += 2;
            break;
        case 0xF000:
            // FX07	Timer	Vx = get_delay()	Sets VX to the value of the delay timer.
            // FX0A	KeyOp	Vx = get_key()	A key press is awaited, and then stored in VX. (Blocking Operation. All instruction halted until next key event)
            // FX15	Timer	delay_timer(Vx)	Sets the delay timer to VX.
            // FX18	Sound	sound_timer(Vx)	Sets the sound timer to VX.
            // FX1E	MEM	I +=Vx	Adds VX to I.[4]
            // FX29	MEM	I=sprite_addr[Vx]	Sets I to the location of the sprite for the character in VX. Characters 0-F (in hexadecimal) are represented by a 4x5 font.
            // FX33	BCD	set_BCD(Vx);
            // *(I+0)=BCD(3);
            // *(I+1)=BCD(2);
            // *(I+2)=BCD(1);
            // Stores the binary-coded decimal representation of VX, with the most significant of three digits
            // at the address in I, the middle digit at I plus 1, and the least significant digit at I plus 2.
            // (In other words, take the decimal representation of VX, place the hundreds digit in memory at location in I,
            // the tens digit at location I+1, and the ones digit at location I+2.)
            // FX55	MEM	reg_dump(Vx,&I)	Stores V0 to VX (including VX) in memory starting at address I. The offset from I is increased by 1 for each value written, but I itself is left unmodified.
            // FX65	MEM	reg_load(Vx,&I)	Fills V0 to VX (including VX) with values from memory starting at address I. The offset from I is increased by 1 for each value written, but I itself is left unmodified.
            X = (opcode & 0x0F00) >> 8;
            switch (opcode & 0x00FF) {
                case 0x0007:
                    V[X] = DT;
                    break;
                case 0x000A:
                    const key = await get_key();
                    V[X] = key.keyCode <= 57 ? key.keyCode - 48 : key.keyCode - 56;
                    console.log(V[X], "charcode="+String.fromCharCode(V[X]));
                    //V[X] -= 48;
                    // TODO
                    break;
                case 0x0015:
                    DT = V[X];
                    break;
                case 0x0018:
                    ST = V[X];
                    break;
                case 0x001E:
                    I += V[X];
                    break;
                case 0x0029:
                    // characters 0-F
                    I = V[X] * 5;
                    console.log(V[X]);
                    break;
                case 0x0033:
                    MEM[I + 0] = parseInt(V[X] / 100) % 10;
                    MEM[I + 1] = parseInt(V[X] / 10) % 10;
                    MEM[I + 2] = parseInt(V[X] / 1) % 10;
                    // num2bcd = Math.ceil(V[X] / 10) << 4 + (V[X] % 10);
                    // MEM[I + 0] = num2bcd & 0x0F00;
                    // MEM[I + 1] = num2bcd & 0x00F0;
                    // MEM[I + 2] = num2bcd & 0x000F;
                    break;
                case 0x0055:
                    for (let i = 0; i <= X; i++) {
                        MEM[I + i] = V[i];
                    }
                    break;
                case 0x0065:
                    for (let i = 0; i <= X; i++) {
                        V[i] = MEM[I + i];
                    }
                    break;
            }
            PC += 2;
            break;
    }
}

let fishie_ch8 = new Uint8Array(0xA0);
fishie_ch8 = [
    0x00, 0xe0, 0xa2, 0x20, 0x62, 0x08, 0x60, 0xf8, 0x70, 0x08, 0x61, 0x10, 0x40, 0x20, 0x12, 0x0e,
    0xd1, 0x08, 0xf2, 0x1e, 0x71, 0x08, 0x41, 0x30, 0x12, 0x08, 0x12, 0x10, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x18, 0x3c, 0x3c, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x3e, 0x3f, 0x3f, 0x3b, 0x39, 0x38, 0x38, 0x38, 0x00, 0x00, 0x80, 0xc1, 0xe7, 0xff, 0x7e, 0x3c,
    0x00, 0x1f, 0xff, 0xf9, 0xc0, 0x80, 0x03, 0x03, 0x00, 0x80, 0xe0, 0xf0, 0x78, 0x38, 0x1c, 0x1c,
    0x38, 0x38, 0x39, 0x3b, 0x3f, 0x3f, 0x3e, 0x3c, 0x78, 0xfc, 0xfe, 0xcf, 0x87, 0x03, 0x01, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x80, 0xe3, 0xff, 0x7f, 0x1c, 0x38, 0x38, 0x70, 0xf0, 0xe0, 0xc0, 0x00,
    0x3c, 0x18, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
];

function testDrawFish() {
    let pixel_test = new Uint8Array(8 * 32); // 32 rows of 64bit each
    // fishie pixels
    fishie_ch8_pixels = [
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x18, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x3c, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x3c, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x3e, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x3f, 0x00, 0x1f, 0x80, 0x00, 0x00,
        0x00, 0x00, 0x3f, 0x80, 0xff, 0xe0, 0x00, 0x00,
        0x00, 0x00, 0x3b, 0xc1, 0xf9, 0xf0, 0x00, 0x00,
        0x00, 0x00, 0x39, 0xe7, 0xc0, 0x78, 0x00, 0x00,
        0x00, 0x00, 0x38, 0xff, 0x80, 0x38, 0x00, 0x00,
        0x00, 0x00, 0x38, 0x7e, 0x03, 0x1c, 0x00, 0x00,
        0x00, 0x00, 0x38, 0x3c, 0x03, 0x1c, 0x00, 0x00,
        0x00, 0x00, 0x38, 0x78, 0x00, 0x1c, 0x00, 0x00,
        0x00, 0x00, 0x38, 0xfc, 0x00, 0x38, 0x00, 0x00,
        0x00, 0x00, 0x39, 0xfe, 0x00, 0x38, 0x00, 0x00,
        0x00, 0x00, 0x3b, 0xcf, 0x00, 0x70, 0x00, 0x00,
        0x00, 0x00, 0x3f, 0x87, 0x80, 0xf0, 0x00, 0x00,
        0x00, 0x00, 0x3f, 0x03, 0xe3, 0xe0, 0x00, 0x00,
        0x00, 0x00, 0x3e, 0x01, 0xff, 0xc0, 0x00, 0x00,
        0x00, 0x00, 0x3c, 0x00, 0x7f, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x3c, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x18, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ];

    // compare screen pixels with test pixels
    let match_failure = false;
    const res = res_x * res_y;
    for (let i = 0; i < res; i++) {
        if (bitmap[i] != fishie_ch8_pixels[i]) {
            match_failure = true;
            break;
        }
    }
    if (match_failure)
        console.log("fishie test failed");
    else
        console.log("fishie test passed");
}