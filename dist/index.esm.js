// 简单的事件发射器实现
class EventEmitter {
    constructor() {
        this.events = {};
    }
    on(event, listener) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
        return this;
    }
    once(event, listener) {
        const onceWrapper = (...args) => {
            this.off(event, onceWrapper);
            listener.apply(this, args);
        };
        this.on(event, onceWrapper);
        return this;
    }
    off(event, listener) {
        if (!this.events[event])
            return this;
        if (!listener) {
            delete this.events[event];
            return this;
        }
        const index = this.events[event].indexOf(listener);
        if (index > -1) {
            this.events[event].splice(index, 1);
        }
        return this;
    }
    emit(event, ...args) {
        if (!this.events[event])
            return false;
        this.events[event].forEach(listener => {
            try {
                listener.apply(this, args);
            }
            catch (error) {
                console.error('Error in event listener:', error);
            }
        });
        return true;
    }
    removeAllListeners(event) {
        if (event) {
            delete this.events[event];
        }
        else {
            this.events = {};
        }
        return this;
    }
    listenerCount(event) {
        return this.events[event] ? this.events[event].length : 0;
    }
}

// DEFLATE is a complex format; to read this code, you should probably check the RFC first:
// https://tools.ietf.org/html/rfc1951
// You may also wish to take a look at the guide I made about this program:
// https://gist.github.com/101arrowz/253f31eb5abc3d9275ab943003ffecad
// Some of the following code is similar to that of UZIP.js:
// https://github.com/photopea/UZIP.js
// However, the vast majority of the codebase has diverged from UZIP.js to increase performance and reduce bundle size.
// Sometimes 0 will appear where -1 would be more appropriate. This is because using a uint
// is better for memory in most engines (I *think*).

// aliases for shorter compressed code (most minifers don't do this)
var u8 = Uint8Array, u16 = Uint16Array, i32 = Int32Array;
// fixed length extra bits
var fleb = new u8([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, /* unused */ 0, 0, /* impossible */ 0]);
// fixed distance extra bits
var fdeb = new u8([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, /* unused */ 0, 0]);
// code length index map
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
// get base, reverse index map from extra bits
var freb = function (eb, start) {
    var b = new u16(31);
    for (var i = 0; i < 31; ++i) {
        b[i] = start += 1 << eb[i - 1];
    }
    // numbers here are at max 18 bits
    var r = new i32(b[30]);
    for (var i = 1; i < 30; ++i) {
        for (var j = b[i]; j < b[i + 1]; ++j) {
            r[j] = ((j - b[i]) << 5) | i;
        }
    }
    return { b: b, r: r };
};
var _a = freb(fleb, 2), fl = _a.b, revfl = _a.r;
// we can ignore the fact that the other numbers are wrong; they never happen anyway
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0), fd = _b.b;
// map of value to reverse (assuming 16 bits)
var rev = new u16(32768);
for (var i = 0; i < 32768; ++i) {
    // reverse table algorithm from SO
    var x = ((i & 0xAAAA) >> 1) | ((i & 0x5555) << 1);
    x = ((x & 0xCCCC) >> 2) | ((x & 0x3333) << 2);
    x = ((x & 0xF0F0) >> 4) | ((x & 0x0F0F) << 4);
    rev[i] = (((x & 0xFF00) >> 8) | ((x & 0x00FF) << 8)) >> 1;
}
// create huffman tree from u8 "map": index -> code length for code index
// mb (max bits) must be at most 15
// TODO: optimize/split up?
var hMap = (function (cd, mb, r) {
    var s = cd.length;
    // index
    var i = 0;
    // u16 "map": index -> # of codes with bit length = index
    var l = new u16(mb);
    // length of cd must be 288 (total # of codes)
    for (; i < s; ++i) {
        if (cd[i])
            ++l[cd[i] - 1];
    }
    // u16 "map": index -> minimum code for bit length = index
    var le = new u16(mb);
    for (i = 1; i < mb; ++i) {
        le[i] = (le[i - 1] + l[i - 1]) << 1;
    }
    var co;
    if (r) {
        // u16 "map": index -> number of actual bits, symbol for code
        co = new u16(1 << mb);
        // bits to remove for reverser
        var rvb = 15 - mb;
        for (i = 0; i < s; ++i) {
            // ignore 0 lengths
            if (cd[i]) {
                // num encoding both symbol and bits read
                var sv = (i << 4) | cd[i];
                // free bits
                var r_1 = mb - cd[i];
                // start value
                var v = le[cd[i] - 1]++ << r_1;
                // m is end value
                for (var m = v | ((1 << r_1) - 1); v <= m; ++v) {
                    // every 16 bit value starting with the code yields the same result
                    co[rev[v] >> rvb] = sv;
                }
            }
        }
    }
    else {
        co = new u16(s);
        for (i = 0; i < s; ++i) {
            if (cd[i]) {
                co[i] = rev[le[cd[i] - 1]++] >> (15 - cd[i]);
            }
        }
    }
    return co;
});
// fixed length tree
var flt = new u8(288);
for (var i = 0; i < 144; ++i)
    flt[i] = 8;
for (var i = 144; i < 256; ++i)
    flt[i] = 9;
for (var i = 256; i < 280; ++i)
    flt[i] = 7;
for (var i = 280; i < 288; ++i)
    flt[i] = 8;
// fixed distance tree
var fdt = new u8(32);
for (var i = 0; i < 32; ++i)
    fdt[i] = 5;
// fixed length map
var flrm = /*#__PURE__*/ hMap(flt, 9, 1);
// fixed distance map
var fdrm = /*#__PURE__*/ hMap(fdt, 5, 1);
// find max of array
var max = function (a) {
    var m = a[0];
    for (var i = 1; i < a.length; ++i) {
        if (a[i] > m)
            m = a[i];
    }
    return m;
};
// read d, starting at bit p and mask with m
var bits = function (d, p, m) {
    var o = (p / 8) | 0;
    return ((d[o] | (d[o + 1] << 8)) >> (p & 7)) & m;
};
// read d, starting at bit p continuing for at least 16 bits
var bits16 = function (d, p) {
    var o = (p / 8) | 0;
    return ((d[o] | (d[o + 1] << 8) | (d[o + 2] << 16)) >> (p & 7));
};
// get end of byte
var shft = function (p) { return ((p + 7) / 8) | 0; };
// typed array slice - allows garbage collector to free original reference,
// while being more compatible than .slice
var slc = function (v, s, e) {
    if (s == null || s < 0)
        s = 0;
    if (e == null || e > v.length)
        e = v.length;
    // can't use .constructor in case user-supplied
    return new u8(v.subarray(s, e));
};
// error codes
var ec = [
    'unexpected EOF',
    'invalid block type',
    'invalid length/literal',
    'invalid distance',
    'stream finished',
    'no stream handler',
    ,
    'no callback',
    'invalid UTF-8 data',
    'extra field too long',
    'date not in range 1980-2099',
    'filename too long',
    'stream finishing',
    'invalid zip data'
    // determined by unknown compression method
];
var err = function (ind, msg, nt) {
    var e = new Error(msg || ec[ind]);
    e.code = ind;
    if (Error.captureStackTrace)
        Error.captureStackTrace(e, err);
    if (!nt)
        throw e;
    return e;
};
// expands raw DEFLATE data
var inflt = function (dat, st, buf, dict) {
    // source length       dict length
    var sl = dat.length, dl = 0;
    if (!sl || st.f && !st.l)
        return buf || new u8(0);
    var noBuf = !buf;
    // have to estimate size
    var resize = noBuf || st.i != 2;
    // no state
    var noSt = st.i;
    // Assumes roughly 33% compression ratio average
    if (noBuf)
        buf = new u8(sl * 3);
    // ensure buffer can fit at least l elements
    var cbuf = function (l) {
        var bl = buf.length;
        // need to increase size to fit
        if (l > bl) {
            // Double or set to necessary, whichever is greater
            var nbuf = new u8(Math.max(bl * 2, l));
            nbuf.set(buf);
            buf = nbuf;
        }
    };
    //  last chunk         bitpos           bytes
    var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
    // total bits
    var tbts = sl * 8;
    do {
        if (!lm) {
            // BFINAL - this is only 1 when last chunk is next
            final = bits(dat, pos, 1);
            // type: 0 = no compression, 1 = fixed huffman, 2 = dynamic huffman
            var type = bits(dat, pos + 1, 3);
            pos += 3;
            if (!type) {
                // go to end of byte boundary
                var s = shft(pos) + 4, l = dat[s - 4] | (dat[s - 3] << 8), t = s + l;
                if (t > sl) {
                    if (noSt)
                        err(0);
                    break;
                }
                // ensure size
                if (resize)
                    cbuf(bt + l);
                // Copy over uncompressed data
                buf.set(dat.subarray(s, t), bt);
                // Get new bitpos, update byte count
                st.b = bt += l, st.p = pos = t * 8, st.f = final;
                continue;
            }
            else if (type == 1)
                lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
            else if (type == 2) {
                //  literal                            lengths
                var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
                var tl = hLit + bits(dat, pos + 5, 31) + 1;
                pos += 14;
                // length+distance tree
                var ldt = new u8(tl);
                // code length tree
                var clt = new u8(19);
                for (var i = 0; i < hcLen; ++i) {
                    // use index map to get real code
                    clt[clim[i]] = bits(dat, pos + i * 3, 7);
                }
                pos += hcLen * 3;
                // code lengths bits
                var clb = max(clt), clbmsk = (1 << clb) - 1;
                // code lengths map
                var clm = hMap(clt, clb, 1);
                for (var i = 0; i < tl;) {
                    var r = clm[bits(dat, pos, clbmsk)];
                    // bits read
                    pos += r & 15;
                    // symbol
                    var s = r >> 4;
                    // code length to copy
                    if (s < 16) {
                        ldt[i++] = s;
                    }
                    else {
                        //  copy   count
                        var c = 0, n = 0;
                        if (s == 16)
                            n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i - 1];
                        else if (s == 17)
                            n = 3 + bits(dat, pos, 7), pos += 3;
                        else if (s == 18)
                            n = 11 + bits(dat, pos, 127), pos += 7;
                        while (n--)
                            ldt[i++] = c;
                    }
                }
                //    length tree                 distance tree
                var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
                // max length bits
                lbt = max(lt);
                // max dist bits
                dbt = max(dt);
                lm = hMap(lt, lbt, 1);
                dm = hMap(dt, dbt, 1);
            }
            else
                err(1);
            if (pos > tbts) {
                if (noSt)
                    err(0);
                break;
            }
        }
        // Make sure the buffer can hold this + the largest possible addition
        // Maximum chunk size (practically, theoretically infinite) is 2^17
        if (resize)
            cbuf(bt + 131072);
        var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
        var lpos = pos;
        for (;; lpos = pos) {
            // bits read, code
            var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
            pos += c & 15;
            if (pos > tbts) {
                if (noSt)
                    err(0);
                break;
            }
            if (!c)
                err(2);
            if (sym < 256)
                buf[bt++] = sym;
            else if (sym == 256) {
                lpos = pos, lm = null;
                break;
            }
            else {
                var add = sym - 254;
                // no extra bits needed if less
                if (sym > 264) {
                    // index
                    var i = sym - 257, b = fleb[i];
                    add = bits(dat, pos, (1 << b) - 1) + fl[i];
                    pos += b;
                }
                // dist
                var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
                if (!d)
                    err(3);
                pos += d & 15;
                var dt = fd[dsym];
                if (dsym > 3) {
                    var b = fdeb[dsym];
                    dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
                }
                if (pos > tbts) {
                    if (noSt)
                        err(0);
                    break;
                }
                if (resize)
                    cbuf(bt + 131072);
                var end = bt + add;
                if (bt < dt) {
                    var shift = dl - dt, dend = Math.min(dt, end);
                    if (shift + bt < 0)
                        err(3);
                    for (; bt < dend; ++bt)
                        buf[bt] = dict[shift + bt];
                }
                for (; bt < end; ++bt)
                    buf[bt] = buf[bt - dt];
            }
        }
        st.l = lm, st.p = lpos, st.b = bt, st.f = final;
        if (lm)
            final = 1, st.m = lbt, st.d = dm, st.n = dbt;
    } while (!final);
    // don't reallocate for streams or user buffers
    return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
};
// empty
var et = /*#__PURE__*/ new u8(0);
// zlib start
var zls = function (d, dict) {
    if ((d[0] & 15) != 8 || (d[0] >> 4) > 7 || ((d[0] << 8 | d[1]) % 31))
        err(6, 'invalid zlib data');
    if ((d[1] >> 5 & 1) == +!dict)
        err(6, 'invalid zlib data: ' + (d[1] & 32 ? 'need' : 'unexpected') + ' dictionary');
    return (d[1] >> 3 & 4) + 2;
};
/**
 * Streaming DEFLATE decompression
 */
var Inflate = /*#__PURE__*/ (function () {
    function Inflate(opts, cb) {
        // no StrmOpt here to avoid adding to workerizer
        if (typeof opts == 'function')
            cb = opts, opts = {};
        this.ondata = cb;
        var dict = opts && opts.dictionary && opts.dictionary.subarray(-32768);
        this.s = { i: 0, b: dict ? dict.length : 0 };
        this.o = new u8(32768);
        this.p = new u8(0);
        if (dict)
            this.o.set(dict);
    }
    Inflate.prototype.e = function (c) {
        if (!this.ondata)
            err(5);
        if (this.d)
            err(4);
        if (!this.p.length)
            this.p = c;
        else if (c.length) {
            var n = new u8(this.p.length + c.length);
            n.set(this.p), n.set(c, this.p.length), this.p = n;
        }
    };
    Inflate.prototype.c = function (final) {
        this.s.i = +(this.d = final || false);
        var bts = this.s.b;
        var dt = inflt(this.p, this.s, this.o);
        this.ondata(slc(dt, bts, this.s.b), this.d);
        this.o = slc(dt, this.s.b - 32768), this.s.b = this.o.length;
        this.p = slc(this.p, (this.s.p / 8) | 0), this.s.p &= 7;
    };
    /**
     * Pushes a chunk to be inflated
     * @param chunk The chunk to push
     * @param final Whether this is the final chunk
     */
    Inflate.prototype.push = function (chunk, final) {
        this.e(chunk), this.c(final);
    };
    return Inflate;
}());
/**
 * Streaming Zlib decompression
 */
var Unzlib = /*#__PURE__*/ (function () {
    function Unzlib(opts, cb) {
        Inflate.call(this, opts, cb);
        this.v = opts && opts.dictionary ? 2 : 1;
    }
    /**
     * Pushes a chunk to be unzlibbed
     * @param chunk The chunk to push
     * @param final Whether this is the last chunk
     */
    Unzlib.prototype.push = function (chunk, final) {
        Inflate.prototype.e.call(this, chunk);
        if (this.v) {
            if (this.p.length < 6 && !final)
                return;
            this.p = this.p.subarray(zls(this.p, this.v - 1)), this.v = 0;
        }
        if (final) {
            if (this.p.length < 4)
                err(6, 'invalid zlib data');
            this.p = this.p.subarray(0, -4);
        }
        // necessary to prevent TS from using the closure value
        // This allows for workerization to function correctly
        Inflate.prototype.c.call(this, final);
    };
    return Unzlib;
}());
/**
 * Expands Zlib data
 * @param data The data to decompress
 * @param opts The decompression options
 * @returns The decompressed version of the data
 */
function unzlibSync(data, opts) {
    return inflt(data.subarray(zls(data, opts), -4), { i: 2 }, opts, opts);
}
// text decoder
var td = typeof TextDecoder != 'undefined' && /*#__PURE__*/ new TextDecoder();
// text decoder stream
var tds = 0;
try {
    td.decode(et, { stream: true });
    tds = 1;
}
catch (e) { }

/**
 * Decode bytes to text
 * @param bytes - Bytes to decode
 * @param encoding - Text encoding
 * @returns The decoded text
 */
function decode(bytes, encoding = 'utf8') {
    const decoder = new TextDecoder(encoding);
    return decoder.decode(bytes);
}
const encoder = new TextEncoder();
/**
 * Encode text to utf8
 * @param str - Text to encode
 * @returns The encoded bytes
 */
function encode(str) {
    return encoder.encode(str);
}

const defaultByteLength = 1024 * 8;
const hostBigEndian = (() => {
    const array = new Uint8Array(4);
    const view = new Uint32Array(array.buffer);
    return !((view[0] = 1) & array[0]);
})();
const typedArrays = {
    int8: globalThis.Int8Array,
    uint8: globalThis.Uint8Array,
    int16: globalThis.Int16Array,
    uint16: globalThis.Uint16Array,
    int32: globalThis.Int32Array,
    uint32: globalThis.Uint32Array,
    uint64: globalThis.BigUint64Array,
    int64: globalThis.BigInt64Array,
    float32: globalThis.Float32Array,
    float64: globalThis.Float64Array,
};
class IOBuffer {
    /**
     * Reference to the internal ArrayBuffer object.
     */
    buffer;
    /**
     * Byte length of the internal ArrayBuffer.
     */
    byteLength;
    /**
     * Byte offset of the internal ArrayBuffer.
     */
    byteOffset;
    /**
     * Byte length of the internal ArrayBuffer.
     */
    length;
    /**
     * The current offset of the buffer's pointer.
     */
    offset;
    lastWrittenByte;
    littleEndian;
    _data;
    _mark;
    _marks;
    /**
     * Create a new IOBuffer.
     * @param data - The data to construct the IOBuffer with.
     * If data is a number, it will be the new buffer's length<br>
     * If data is `undefined`, the buffer will be initialized with a default length of 8Kb<br>
     * If data is an ArrayBuffer, SharedArrayBuffer, an ArrayBufferView (Typed Array), an IOBuffer instance,
     * or a Node.js Buffer, a view will be created over the underlying ArrayBuffer.
     * @param options - An object for the options.
     * @returns A new IOBuffer instance.
     */
    constructor(data = defaultByteLength, options = {}) {
        let dataIsGiven = false;
        if (typeof data === 'number') {
            data = new ArrayBuffer(data);
        }
        else {
            dataIsGiven = true;
            this.lastWrittenByte = data.byteLength;
        }
        const offset = options.offset ? options.offset >>> 0 : 0;
        const byteLength = data.byteLength - offset;
        let dvOffset = offset;
        if (ArrayBuffer.isView(data) || data instanceof IOBuffer) {
            if (data.byteLength !== data.buffer.byteLength) {
                dvOffset = data.byteOffset + offset;
            }
            data = data.buffer;
        }
        if (dataIsGiven) {
            this.lastWrittenByte = byteLength;
        }
        else {
            this.lastWrittenByte = 0;
        }
        this.buffer = data;
        this.length = byteLength;
        this.byteLength = byteLength;
        this.byteOffset = dvOffset;
        this.offset = 0;
        this.littleEndian = true;
        this._data = new DataView(this.buffer, dvOffset, byteLength);
        this._mark = 0;
        this._marks = [];
    }
    /**
     * Checks if the memory allocated to the buffer is sufficient to store more
     * bytes after the offset.
     * @param byteLength - The needed memory in bytes.
     * @returns `true` if there is sufficient space and `false` otherwise.
     */
    available(byteLength = 1) {
        return this.offset + byteLength <= this.length;
    }
    /**
     * Check if little-endian mode is used for reading and writing multi-byte
     * values.
     * @returns `true` if little-endian mode is used, `false` otherwise.
     */
    isLittleEndian() {
        return this.littleEndian;
    }
    /**
     * Set little-endian mode for reading and writing multi-byte values.
     * @returns This.
     */
    setLittleEndian() {
        this.littleEndian = true;
        return this;
    }
    /**
     * Check if big-endian mode is used for reading and writing multi-byte values.
     * @returns `true` if big-endian mode is used, `false` otherwise.
     */
    isBigEndian() {
        return !this.littleEndian;
    }
    /**
     * Switches to big-endian mode for reading and writing multi-byte values.
     * @returns This.
     */
    setBigEndian() {
        this.littleEndian = false;
        return this;
    }
    /**
     * Move the pointer n bytes forward.
     * @param n - Number of bytes to skip.
     * @returns This.
     */
    skip(n = 1) {
        this.offset += n;
        return this;
    }
    /**
     * Move the pointer n bytes backward.
     * @param n - Number of bytes to move back.
     * @returns This.
     */
    back(n = 1) {
        this.offset -= n;
        return this;
    }
    /**
     * Move the pointer to the given offset.
     * @param offset - The offset to move to.
     * @returns This.
     */
    seek(offset) {
        this.offset = offset;
        return this;
    }
    /**
     * Store the current pointer offset.
     * @see {@link IOBuffer#reset}
     * @returns This.
     */
    mark() {
        this._mark = this.offset;
        return this;
    }
    /**
     * Move the pointer back to the last pointer offset set by mark.
     * @see {@link IOBuffer#mark}
     * @returns This.
     */
    reset() {
        this.offset = this._mark;
        return this;
    }
    /**
     * Push the current pointer offset to the mark stack.
     * @see {@link IOBuffer#popMark}
     * @returns This.
     */
    pushMark() {
        this._marks.push(this.offset);
        return this;
    }
    /**
     * Pop the last pointer offset from the mark stack, and set the current
     * pointer offset to the popped value.
     * @see {@link IOBuffer#pushMark}
     * @returns This.
     */
    popMark() {
        const offset = this._marks.pop();
        if (offset === undefined) {
            throw new Error('Mark stack empty');
        }
        this.seek(offset);
        return this;
    }
    /**
     * Move the pointer offset back to 0.
     * @returns This.
     */
    rewind() {
        this.offset = 0;
        return this;
    }
    /**
     * Make sure the buffer has sufficient memory to write a given byteLength at
     * the current pointer offset.
     * If the buffer's memory is insufficient, this method will create a new
     * buffer (a copy) with a length that is twice (byteLength + current offset).
     * @param byteLength - The needed memory in bytes.
     * @returns This.
     */
    ensureAvailable(byteLength = 1) {
        if (!this.available(byteLength)) {
            const lengthNeeded = this.offset + byteLength;
            const newLength = lengthNeeded * 2;
            const newArray = new Uint8Array(newLength);
            newArray.set(new Uint8Array(this.buffer));
            this.buffer = newArray.buffer;
            this.length = newLength;
            this.byteLength = newLength;
            this._data = new DataView(this.buffer);
        }
        return this;
    }
    /**
     * Read a byte and return false if the byte's value is 0, or true otherwise.
     * Moves pointer forward by one byte.
     * @returns The read boolean.
     */
    readBoolean() {
        return this.readUint8() !== 0;
    }
    /**
     * Read a signed 8-bit integer and move pointer forward by 1 byte.
     * @returns The read byte.
     */
    readInt8() {
        return this._data.getInt8(this.offset++);
    }
    /**
     * Read an unsigned 8-bit integer and move pointer forward by 1 byte.
     * @returns The read byte.
     */
    readUint8() {
        return this._data.getUint8(this.offset++);
    }
    /**
     * Alias for {@link IOBuffer#readUint8}.
     * @returns The read byte.
     */
    readByte() {
        return this.readUint8();
    }
    /**
     * Read `n` bytes and move pointer forward by `n` bytes.
     * @param n - Number of bytes to read.
     * @returns The read bytes.
     */
    readBytes(n = 1) {
        return this.readArray(n, 'uint8');
    }
    /**
     * Creates an array of corresponding to the type `type` and size `size`.
     * For example, type `uint8` will create a `Uint8Array`.
     * @param size - size of the resulting array
     * @param type - number type of elements to read
     * @returns The read array.
     */
    readArray(size, type) {
        const bytes = typedArrays[type].BYTES_PER_ELEMENT * size;
        const offset = this.byteOffset + this.offset;
        const slice = this.buffer.slice(offset, offset + bytes);
        if (this.littleEndian === hostBigEndian &&
            type !== 'uint8' &&
            type !== 'int8') {
            const slice = new Uint8Array(this.buffer.slice(offset, offset + bytes));
            slice.reverse();
            const returnArray = new typedArrays[type](slice.buffer);
            this.offset += bytes;
            returnArray.reverse();
            return returnArray;
        }
        const returnArray = new typedArrays[type](slice);
        this.offset += bytes;
        return returnArray;
    }
    /**
     * Read a 16-bit signed integer and move pointer forward by 2 bytes.
     * @returns The read value.
     */
    readInt16() {
        const value = this._data.getInt16(this.offset, this.littleEndian);
        this.offset += 2;
        return value;
    }
    /**
     * Read a 16-bit unsigned integer and move pointer forward by 2 bytes.
     * @returns The read value.
     */
    readUint16() {
        const value = this._data.getUint16(this.offset, this.littleEndian);
        this.offset += 2;
        return value;
    }
    /**
     * Read a 32-bit signed integer and move pointer forward by 4 bytes.
     * @returns The read value.
     */
    readInt32() {
        const value = this._data.getInt32(this.offset, this.littleEndian);
        this.offset += 4;
        return value;
    }
    /**
     * Read a 32-bit unsigned integer and move pointer forward by 4 bytes.
     * @returns The read value.
     */
    readUint32() {
        const value = this._data.getUint32(this.offset, this.littleEndian);
        this.offset += 4;
        return value;
    }
    /**
     * Read a 32-bit floating number and move pointer forward by 4 bytes.
     * @returns The read value.
     */
    readFloat32() {
        const value = this._data.getFloat32(this.offset, this.littleEndian);
        this.offset += 4;
        return value;
    }
    /**
     * Read a 64-bit floating number and move pointer forward by 8 bytes.
     * @returns The read value.
     */
    readFloat64() {
        const value = this._data.getFloat64(this.offset, this.littleEndian);
        this.offset += 8;
        return value;
    }
    /**
     * Read a 64-bit signed integer number and move pointer forward by 8 bytes.
     * @returns The read value.
     */
    readBigInt64() {
        const value = this._data.getBigInt64(this.offset, this.littleEndian);
        this.offset += 8;
        return value;
    }
    /**
     * Read a 64-bit unsigned integer number and move pointer forward by 8 bytes.
     * @returns The read value.
     */
    readBigUint64() {
        const value = this._data.getBigUint64(this.offset, this.littleEndian);
        this.offset += 8;
        return value;
    }
    /**
     * Read a 1-byte ASCII character and move pointer forward by 1 byte.
     * @returns The read character.
     */
    readChar() {
        // eslint-disable-next-line unicorn/prefer-code-point
        return String.fromCharCode(this.readInt8());
    }
    /**
     * Read `n` 1-byte ASCII characters and move pointer forward by `n` bytes.
     * @param n - Number of characters to read.
     * @returns The read characters.
     */
    readChars(n = 1) {
        let result = '';
        for (let i = 0; i < n; i++) {
            result += this.readChar();
        }
        return result;
    }
    /**
     * Read the next `n` bytes, return a UTF-8 decoded string and move pointer
     * forward by `n` bytes.
     * @param n - Number of bytes to read.
     * @returns The decoded string.
     */
    readUtf8(n = 1) {
        return decode(this.readBytes(n));
    }
    /**
     * Read the next `n` bytes, return a string decoded with `encoding` and move pointer
     * forward by `n` bytes.
     * If no encoding is passed, the function is equivalent to @see {@link IOBuffer#readUtf8}
     * @param n - Number of bytes to read.
     * @param encoding - The encoding to use. Default is 'utf8'.
     * @returns The decoded string.
     */
    decodeText(n = 1, encoding = 'utf8') {
        return decode(this.readBytes(n), encoding);
    }
    /**
     * Write 0xff if the passed value is truthy, 0x00 otherwise and move pointer
     * forward by 1 byte.
     * @param value - The value to write.
     * @returns This.
     */
    writeBoolean(value) {
        this.writeUint8(value ? 0xff : 0x00);
        return this;
    }
    /**
     * Write `value` as an 8-bit signed integer and move pointer forward by 1 byte.
     * @param value - The value to write.
     * @returns This.
     */
    writeInt8(value) {
        this.ensureAvailable(1);
        this._data.setInt8(this.offset++, value);
        this._updateLastWrittenByte();
        return this;
    }
    /**
     * Write `value` as an 8-bit unsigned integer and move pointer forward by 1
     * byte.
     * @param value - The value to write.
     * @returns This.
     */
    writeUint8(value) {
        this.ensureAvailable(1);
        this._data.setUint8(this.offset++, value);
        this._updateLastWrittenByte();
        return this;
    }
    /**
     * An alias for {@link IOBuffer#writeUint8}.
     * @param value - The value to write.
     * @returns This.
     */
    writeByte(value) {
        return this.writeUint8(value);
    }
    /**
     * Write all elements of `bytes` as uint8 values and move pointer forward by
     * `bytes.length` bytes.
     * @param bytes - The array of bytes to write.
     * @returns This.
     */
    writeBytes(bytes) {
        this.ensureAvailable(bytes.length);
        // eslint-disable-next-line @typescript-eslint/prefer-for-of
        for (let i = 0; i < bytes.length; i++) {
            this._data.setUint8(this.offset++, bytes[i]);
        }
        this._updateLastWrittenByte();
        return this;
    }
    /**
     * Write `value` as a 16-bit signed integer and move pointer forward by 2
     * bytes.
     * @param value - The value to write.
     * @returns This.
     */
    writeInt16(value) {
        this.ensureAvailable(2);
        this._data.setInt16(this.offset, value, this.littleEndian);
        this.offset += 2;
        this._updateLastWrittenByte();
        return this;
    }
    /**
     * Write `value` as a 16-bit unsigned integer and move pointer forward by 2
     * bytes.
     * @param value - The value to write.
     * @returns This.
     */
    writeUint16(value) {
        this.ensureAvailable(2);
        this._data.setUint16(this.offset, value, this.littleEndian);
        this.offset += 2;
        this._updateLastWrittenByte();
        return this;
    }
    /**
     * Write `value` as a 32-bit signed integer and move pointer forward by 4
     * bytes.
     * @param value - The value to write.
     * @returns This.
     */
    writeInt32(value) {
        this.ensureAvailable(4);
        this._data.setInt32(this.offset, value, this.littleEndian);
        this.offset += 4;
        this._updateLastWrittenByte();
        return this;
    }
    /**
     * Write `value` as a 32-bit unsigned integer and move pointer forward by 4
     * bytes.
     * @param value - The value to write.
     * @returns This.
     */
    writeUint32(value) {
        this.ensureAvailable(4);
        this._data.setUint32(this.offset, value, this.littleEndian);
        this.offset += 4;
        this._updateLastWrittenByte();
        return this;
    }
    /**
     * Write `value` as a 32-bit floating number and move pointer forward by 4
     * bytes.
     * @param value - The value to write.
     * @returns This.
     */
    writeFloat32(value) {
        this.ensureAvailable(4);
        this._data.setFloat32(this.offset, value, this.littleEndian);
        this.offset += 4;
        this._updateLastWrittenByte();
        return this;
    }
    /**
     * Write `value` as a 64-bit floating number and move pointer forward by 8
     * bytes.
     * @param value - The value to write.
     * @returns This.
     */
    writeFloat64(value) {
        this.ensureAvailable(8);
        this._data.setFloat64(this.offset, value, this.littleEndian);
        this.offset += 8;
        this._updateLastWrittenByte();
        return this;
    }
    /**
     * Write `value` as a 64-bit signed bigint and move pointer forward by 8
     * bytes.
     * @param value - The value to write.
     * @returns This.
     */
    writeBigInt64(value) {
        this.ensureAvailable(8);
        this._data.setBigInt64(this.offset, value, this.littleEndian);
        this.offset += 8;
        this._updateLastWrittenByte();
        return this;
    }
    /**
     * Write `value` as a 64-bit unsigned bigint and move pointer forward by 8
     * bytes.
     * @param value - The value to write.
     * @returns This.
     */
    writeBigUint64(value) {
        this.ensureAvailable(8);
        this._data.setBigUint64(this.offset, value, this.littleEndian);
        this.offset += 8;
        this._updateLastWrittenByte();
        return this;
    }
    /**
     * Write the charCode of `str`'s first character as an 8-bit unsigned integer
     * and move pointer forward by 1 byte.
     * @param str - The character to write.
     * @returns This.
     */
    writeChar(str) {
        // eslint-disable-next-line unicorn/prefer-code-point
        return this.writeUint8(str.charCodeAt(0));
    }
    /**
     * Write the charCodes of all `str`'s characters as 8-bit unsigned integers
     * and move pointer forward by `str.length` bytes.
     * @param str - The characters to write.
     * @returns This.
     */
    writeChars(str) {
        for (let i = 0; i < str.length; i++) {
            // eslint-disable-next-line unicorn/prefer-code-point
            this.writeUint8(str.charCodeAt(i));
        }
        return this;
    }
    /**
     * UTF-8 encode and write `str` to the current pointer offset and move pointer
     * forward according to the encoded length.
     * @param str - The string to write.
     * @returns This.
     */
    writeUtf8(str) {
        return this.writeBytes(encode(str));
    }
    /**
     * Export a Uint8Array view of the internal buffer.
     * The view starts at the byte offset and its length
     * is calculated to stop at the last written byte or the original length.
     * @returns A new Uint8Array view.
     */
    toArray() {
        return new Uint8Array(this.buffer, this.byteOffset, this.lastWrittenByte);
    }
    /**
     *  Get the total number of bytes written so far, regardless of the current offset.
     * @returns - Total number of bytes.
     */
    getWrittenByteLength() {
        return this.lastWrittenByte - this.byteOffset;
    }
    /**
     * Update the last written byte offset
     * @private
     */
    _updateLastWrittenByte() {
        if (this.offset > this.lastWrittenByte) {
            this.lastWrittenByte = this.offset;
        }
    }
}

const crcTable = [];
for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
        if (c & 1) {
            c = 0xedb88320 ^ (c >>> 1);
        }
        else {
            c = c >>> 1;
        }
    }
    crcTable[n] = c;
}
const initialCrc = 0xffffffff;
function updateCrc(currentCrc, data, length) {
    let c = currentCrc;
    for (let n = 0; n < length; n++) {
        c = crcTable[(c ^ data[n]) & 0xff] ^ (c >>> 8);
    }
    return c;
}
function crc(data, length) {
    return (updateCrc(initialCrc, data, length) ^ initialCrc) >>> 0;
}
function checkCrc(buffer, crcLength, chunkName) {
    const expectedCrc = buffer.readUint32();
    const actualCrc = crc(new Uint8Array(buffer.buffer, buffer.byteOffset + buffer.offset - crcLength - 4, crcLength), crcLength); // "- 4" because we already advanced by reading the CRC
    if (actualCrc !== expectedCrc) {
        throw new Error(`CRC mismatch for chunk ${chunkName}. Expected ${expectedCrc}, found ${actualCrc}`);
    }
}

function unfilterNone(currentLine, newLine, bytesPerLine) {
    for (let i = 0; i < bytesPerLine; i++) {
        newLine[i] = currentLine[i];
    }
}
function unfilterSub(currentLine, newLine, bytesPerLine, bytesPerPixel) {
    let i = 0;
    for (; i < bytesPerPixel; i++) {
        // just copy first bytes
        newLine[i] = currentLine[i];
    }
    for (; i < bytesPerLine; i++) {
        newLine[i] = (currentLine[i] + newLine[i - bytesPerPixel]) & 0xff;
    }
}
function unfilterUp(currentLine, newLine, prevLine, bytesPerLine) {
    let i = 0;
    if (prevLine.length === 0) {
        // just copy bytes for first line
        for (; i < bytesPerLine; i++) {
            newLine[i] = currentLine[i];
        }
    }
    else {
        for (; i < bytesPerLine; i++) {
            newLine[i] = (currentLine[i] + prevLine[i]) & 0xff;
        }
    }
}
function unfilterAverage(currentLine, newLine, prevLine, bytesPerLine, bytesPerPixel) {
    let i = 0;
    if (prevLine.length === 0) {
        for (; i < bytesPerPixel; i++) {
            newLine[i] = currentLine[i];
        }
        for (; i < bytesPerLine; i++) {
            newLine[i] = (currentLine[i] + (newLine[i - bytesPerPixel] >> 1)) & 0xff;
        }
    }
    else {
        for (; i < bytesPerPixel; i++) {
            newLine[i] = (currentLine[i] + (prevLine[i] >> 1)) & 0xff;
        }
        for (; i < bytesPerLine; i++) {
            newLine[i] =
                (currentLine[i] + ((newLine[i - bytesPerPixel] + prevLine[i]) >> 1)) &
                    0xff;
        }
    }
}
function unfilterPaeth(currentLine, newLine, prevLine, bytesPerLine, bytesPerPixel) {
    let i = 0;
    if (prevLine.length === 0) {
        for (; i < bytesPerPixel; i++) {
            newLine[i] = currentLine[i];
        }
        for (; i < bytesPerLine; i++) {
            newLine[i] = (currentLine[i] + newLine[i - bytesPerPixel]) & 0xff;
        }
    }
    else {
        for (; i < bytesPerPixel; i++) {
            newLine[i] = (currentLine[i] + prevLine[i]) & 0xff;
        }
        for (; i < bytesPerLine; i++) {
            newLine[i] =
                (currentLine[i] +
                    paethPredictor(newLine[i - bytesPerPixel], prevLine[i], prevLine[i - bytesPerPixel])) &
                    0xff;
        }
    }
}
function paethPredictor(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc)
        return a;
    else if (pb <= pc)
        return b;
    else
        return c;
}

/**
 * Apllies filter on scanline based on the filter type.
 * @param filterType - The filter type to apply.
 * @param currentLine - The current line of pixel data.
 * @param newLine - The new line of pixel data.
 * @param prevLine - The previous line of pixel data.
 * @param passLineBytes - The number of bytes in the pass line.
 * @param bytesPerPixel - The number of bytes per pixel.
 */
function applyUnfilter(filterType, currentLine, newLine, prevLine, passLineBytes, bytesPerPixel) {
    switch (filterType) {
        case 0:
            unfilterNone(currentLine, newLine, passLineBytes);
            break;
        case 1:
            unfilterSub(currentLine, newLine, passLineBytes, bytesPerPixel);
            break;
        case 2:
            unfilterUp(currentLine, newLine, prevLine, passLineBytes);
            break;
        case 3:
            unfilterAverage(currentLine, newLine, prevLine, passLineBytes, bytesPerPixel);
            break;
        case 4:
            unfilterPaeth(currentLine, newLine, prevLine, passLineBytes, bytesPerPixel);
            break;
        default:
            throw new Error(`Unsupported filter: ${filterType}`);
    }
}

const uint16$1 = new Uint16Array([0x00ff]);
const uint8$1 = new Uint8Array(uint16$1.buffer);
const osIsLittleEndian$1 = uint8$1[0] === 0xff;
/**
 * Decodes the Adam7 interlaced PNG data.
 * @param params - DecodeInterlaceNullParams
 * @returns - array of pixel data.
 */
function decodeInterlaceAdam7(params) {
    const { data, width, height, channels, depth } = params;
    // Adam7 interlacing pattern
    const passes = [
        { x: 0, y: 0, xStep: 8, yStep: 8 }, // Pass 1
        { x: 4, y: 0, xStep: 8, yStep: 8 }, // Pass 2
        { x: 0, y: 4, xStep: 4, yStep: 8 }, // Pass 3
        { x: 2, y: 0, xStep: 4, yStep: 4 }, // Pass 4
        { x: 0, y: 2, xStep: 2, yStep: 4 }, // Pass 5
        { x: 1, y: 0, xStep: 2, yStep: 2 }, // Pass 6
        { x: 0, y: 1, xStep: 1, yStep: 2 }, // Pass 7
    ];
    const bytesPerPixel = Math.ceil(depth / 8) * channels;
    const resultData = new Uint8Array(height * width * bytesPerPixel);
    let offset = 0;
    // Process each pass
    for (let passIndex = 0; passIndex < 7; passIndex++) {
        const pass = passes[passIndex];
        // Calculate pass dimensions
        const passWidth = Math.ceil((width - pass.x) / pass.xStep);
        const passHeight = Math.ceil((height - pass.y) / pass.yStep);
        if (passWidth <= 0 || passHeight <= 0)
            continue;
        const passLineBytes = passWidth * bytesPerPixel;
        const prevLine = new Uint8Array(passLineBytes);
        // Process each scanline in this pass
        for (let y = 0; y < passHeight; y++) {
            // First byte is the filter type
            const filterType = data[offset++];
            const currentLine = data.subarray(offset, offset + passLineBytes);
            offset += passLineBytes;
            // Create a new line for the unfiltered data
            const newLine = new Uint8Array(passLineBytes);
            // Apply the appropriate unfilter
            applyUnfilter(filterType, currentLine, newLine, prevLine, passLineBytes, bytesPerPixel);
            prevLine.set(newLine);
            for (let x = 0; x < passWidth; x++) {
                const outputX = pass.x + x * pass.xStep;
                const outputY = pass.y + y * pass.yStep;
                if (outputX >= width || outputY >= height)
                    continue;
                for (let i = 0; i < bytesPerPixel; i++) {
                    resultData[(outputY * width + outputX) * bytesPerPixel + i] =
                        newLine[x * bytesPerPixel + i];
                }
            }
        }
    }
    if (depth === 16) {
        const uint16Data = new Uint16Array(resultData.buffer);
        if (osIsLittleEndian$1) {
            for (let k = 0; k < uint16Data.length; k++) {
                // PNG is always big endian. Swap the bytes.
                uint16Data[k] = swap16$1(uint16Data[k]);
            }
        }
        return uint16Data;
    }
    else {
        return resultData;
    }
}
function swap16$1(val) {
    return ((val & 0xff) << 8) | ((val >> 8) & 0xff);
}

const uint16 = new Uint16Array([0x00ff]);
const uint8 = new Uint8Array(uint16.buffer);
const osIsLittleEndian = uint8[0] === 0xff;
const empty = new Uint8Array(0);
function decodeInterlaceNull(params) {
    const { data, width, height, channels, depth } = params;
    const bytesPerPixel = Math.ceil(depth / 8) * channels;
    const bytesPerLine = Math.ceil((depth / 8) * channels * width);
    const newData = new Uint8Array(height * bytesPerLine);
    let prevLine = empty;
    let offset = 0;
    let currentLine;
    let newLine;
    for (let i = 0; i < height; i++) {
        currentLine = data.subarray(offset + 1, offset + 1 + bytesPerLine);
        newLine = newData.subarray(i * bytesPerLine, (i + 1) * bytesPerLine);
        switch (data[offset]) {
            case 0:
                unfilterNone(currentLine, newLine, bytesPerLine);
                break;
            case 1:
                unfilterSub(currentLine, newLine, bytesPerLine, bytesPerPixel);
                break;
            case 2:
                unfilterUp(currentLine, newLine, prevLine, bytesPerLine);
                break;
            case 3:
                unfilterAverage(currentLine, newLine, prevLine, bytesPerLine, bytesPerPixel);
                break;
            case 4:
                unfilterPaeth(currentLine, newLine, prevLine, bytesPerLine, bytesPerPixel);
                break;
            default:
                throw new Error(`Unsupported filter: ${data[offset]}`);
        }
        prevLine = newLine;
        offset += bytesPerLine + 1;
    }
    if (depth === 16) {
        const uint16Data = new Uint16Array(newData.buffer);
        if (osIsLittleEndian) {
            for (let k = 0; k < uint16Data.length; k++) {
                // PNG is always big endian. Swap the bytes.
                uint16Data[k] = swap16(uint16Data[k]);
            }
        }
        return uint16Data;
    }
    else {
        return newData;
    }
}
function swap16(val) {
    return ((val & 0xff) << 8) | ((val >> 8) & 0xff);
}

// https://www.w3.org/TR/PNG/#5PNG-file-signature
const pngSignature = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
function checkSignature(buffer) {
    if (!hasPngSignature(buffer.readBytes(pngSignature.length))) {
        throw new Error('wrong PNG signature');
    }
}
function hasPngSignature(array) {
    if (array.length < pngSignature.length) {
        return false;
    }
    for (let i = 0; i < pngSignature.length; i++) {
        if (array[i] !== pngSignature[i]) {
            return false;
        }
    }
    return true;
}

// https://www.w3.org/TR/png/#11tEXt
const textChunkName = 'tEXt';
const NULL = 0;
const latin1Decoder = new TextDecoder('latin1');
function validateKeyword(keyword) {
    validateLatin1(keyword);
    if (keyword.length === 0 || keyword.length > 79) {
        throw new Error('keyword length must be between 1 and 79');
    }
}
// eslint-disable-next-line no-control-regex
const latin1Regex = /^[\u0000-\u00FF]*$/;
function validateLatin1(text) {
    if (!latin1Regex.test(text)) {
        throw new Error('invalid latin1 text');
    }
}
function decodetEXt(text, buffer, length) {
    const keyword = readKeyword(buffer);
    text[keyword] = readLatin1(buffer, length - keyword.length - 1);
}
// https://www.w3.org/TR/png/#11keywords
function readKeyword(buffer) {
    buffer.mark();
    while (buffer.readByte() !== NULL) {
        /* advance */
    }
    const end = buffer.offset;
    buffer.reset();
    const keyword = latin1Decoder.decode(buffer.readBytes(end - buffer.offset - 1));
    // NULL
    buffer.skip(1);
    validateKeyword(keyword);
    return keyword;
}
function readLatin1(buffer, length) {
    return latin1Decoder.decode(buffer.readBytes(length));
}

const ColorType = {
    UNKNOWN: -1,
    GREYSCALE: 0,
    TRUECOLOUR: 2,
    INDEXED_COLOUR: 3,
    GREYSCALE_ALPHA: 4,
    TRUECOLOUR_ALPHA: 6,
};
const CompressionMethod = {
    UNKNOWN: -1,
    DEFLATE: 0,
};
const FilterMethod = {
    UNKNOWN: -1,
    ADAPTIVE: 0,
};
const InterlaceMethod = {
    UNKNOWN: -1,
    NO_INTERLACE: 0,
    ADAM7: 1,
};
const DisposeOpType = {
    NONE: 0,
    BACKGROUND: 1,
    PREVIOUS: 2,
};
const BlendOpType = {
    SOURCE: 0,
    OVER: 1,
};

class PngDecoder extends IOBuffer {
    _checkCrc;
    _inflator;
    _png;
    _apng;
    _end;
    _hasPalette;
    _palette;
    _hasTransparency;
    _transparency;
    _compressionMethod;
    _filterMethod;
    _interlaceMethod;
    _colorType;
    _isAnimated;
    _numberOfFrames;
    _numberOfPlays;
    _frames;
    _writingDataChunks;
    _chunks;
    _inflatorResult;
    constructor(data, options = {}) {
        super(data);
        const { checkCrc = false } = options;
        this._checkCrc = checkCrc;
        this._inflator = new Unzlib((chunk, final) => {
            this._chunks.push(chunk);
            if (final) {
                const totalLength = this._chunks.reduce((sum, c) => sum + c.length, 0);
                this._inflatorResult = new Uint8Array(totalLength);
                let offset = 0;
                for (const chunk of this._chunks) {
                    this._inflatorResult.set(chunk, offset);
                    offset += chunk.length;
                }
                this._chunks = [];
            }
        });
        this._chunks = [];
        this._png = {
            width: -1,
            height: -1,
            channels: -1,
            data: new Uint8Array(0),
            depth: 1,
            text: {},
        };
        this._apng = {
            width: -1,
            height: -1,
            channels: -1,
            depth: 1,
            numberOfFrames: 1,
            numberOfPlays: 0,
            text: {},
            frames: [],
        };
        this._end = false;
        this._hasPalette = false;
        this._palette = [];
        this._hasTransparency = false;
        this._transparency = new Uint16Array(0);
        this._compressionMethod = CompressionMethod.UNKNOWN;
        this._filterMethod = FilterMethod.UNKNOWN;
        this._interlaceMethod = InterlaceMethod.UNKNOWN;
        this._colorType = ColorType.UNKNOWN;
        this._isAnimated = false;
        this._numberOfFrames = 1;
        this._numberOfPlays = 0;
        this._frames = [];
        this._writingDataChunks = false;
        this._inflatorResult = new Uint8Array(0);
        // PNG is always big endian
        // https://www.w3.org/TR/PNG/#7Integers-and-byte-order
        this.setBigEndian();
    }
    decode() {
        checkSignature(this);
        while (!this._end) {
            const length = this.readUint32();
            const type = this.readChars(4);
            this.decodeChunk(length, type);
        }
        this._inflator.push(new Uint8Array(0), true);
        this.decodeImage();
        return this._png;
    }
    decodeApng() {
        checkSignature(this);
        while (!this._end) {
            const length = this.readUint32();
            const type = this.readChars(4);
            this.decodeApngChunk(length, type);
        }
        this.decodeApngImage();
        return this._apng;
    }
    // https://www.w3.org/TR/PNG/#5Chunk-layout
    decodeChunk(length, type) {
        const offset = this.offset;
        switch (type) {
            // 11.2 Critical chunks
            case 'IHDR': // 11.2.2 IHDR Image header
                this.decodeIHDR();
                break;
            case 'PLTE': // 11.2.3 PLTE Palette
                this.decodePLTE(length);
                break;
            case 'IDAT': // 11.2.4 IDAT Image data
                this.decodeIDAT(length);
                break;
            case 'IEND': // 11.2.5 IEND Image trailer
                this._end = true;
                break;
            // 11.3 Ancillary chunks
            case 'tRNS': // 11.3.2.1 tRNS Transparency
                this.decodetRNS(length);
                break;
            case 'iCCP': // 11.3.3.3 iCCP Embedded ICC profile
                this.decodeiCCP(length);
                break;
            case textChunkName: // 11.3.4.3 tEXt Textual data
                decodetEXt(this._png.text, this, length);
                break;
            case 'pHYs': // 11.3.5.3 pHYs Physical pixel dimensions
                this.decodepHYs();
                break;
            default:
                this.skip(length);
                break;
        }
        if (this.offset - offset !== length) {
            throw new Error(`Length mismatch while decoding chunk ${type}`);
        }
        if (this._checkCrc) {
            checkCrc(this, length + 4, type);
        }
        else {
            this.skip(4);
        }
    }
    decodeApngChunk(length, type) {
        const offset = this.offset;
        if (type !== 'fdAT' && type !== 'IDAT' && this._writingDataChunks) {
            this.pushDataToFrame();
        }
        switch (type) {
            case 'acTL':
                this.decodeACTL();
                break;
            case 'fcTL':
                this.decodeFCTL();
                break;
            case 'fdAT':
                this.decodeFDAT(length);
                break;
            default:
                this.decodeChunk(length, type);
                this.offset = offset + length;
                break;
        }
        if (this.offset - offset !== length) {
            throw new Error(`Length mismatch while decoding chunk ${type}`);
        }
        if (this._checkCrc) {
            checkCrc(this, length + 4, type);
        }
        else {
            this.skip(4);
        }
    }
    // https://www.w3.org/TR/PNG/#11IHDR
    decodeIHDR() {
        const image = this._png;
        image.width = this.readUint32();
        image.height = this.readUint32();
        image.depth = checkBitDepth(this.readUint8());
        const colorType = this.readUint8();
        this._colorType = colorType;
        let channels;
        switch (colorType) {
            case ColorType.GREYSCALE:
                channels = 1;
                break;
            case ColorType.TRUECOLOUR:
                channels = 3;
                break;
            case ColorType.INDEXED_COLOUR:
                channels = 1;
                break;
            case ColorType.GREYSCALE_ALPHA:
                channels = 2;
                break;
            case ColorType.TRUECOLOUR_ALPHA:
                channels = 4;
                break;
            // Kept for exhaustiveness.
            // eslint-disable-next-line unicorn/no-useless-switch-case
            case ColorType.UNKNOWN:
            default:
                throw new Error(`Unknown color type: ${colorType}`);
        }
        this._png.channels = channels;
        this._compressionMethod = this.readUint8();
        if (this._compressionMethod !== CompressionMethod.DEFLATE) {
            throw new Error(`Unsupported compression method: ${this._compressionMethod}`);
        }
        this._filterMethod = this.readUint8();
        this._interlaceMethod = this.readUint8();
    }
    decodeACTL() {
        this._numberOfFrames = this.readUint32();
        this._numberOfPlays = this.readUint32();
        this._isAnimated = true;
    }
    decodeFCTL() {
        const image = {
            sequenceNumber: this.readUint32(),
            width: this.readUint32(),
            height: this.readUint32(),
            xOffset: this.readUint32(),
            yOffset: this.readUint32(),
            delayNumber: this.readUint16(),
            delayDenominator: this.readUint16(),
            disposeOp: this.readUint8(),
            blendOp: this.readUint8(),
            data: new Uint8Array(0),
        };
        this._frames.push(image);
    }
    // https://www.w3.org/TR/PNG/#11PLTE
    decodePLTE(length) {
        if (length % 3 !== 0) {
            throw new RangeError(`PLTE field length must be a multiple of 3. Got ${length}`);
        }
        const l = length / 3;
        this._hasPalette = true;
        const palette = [];
        this._palette = palette;
        for (let i = 0; i < l; i++) {
            palette.push([this.readUint8(), this.readUint8(), this.readUint8()]);
        }
    }
    // https://www.w3.org/TR/PNG/#11IDAT
    decodeIDAT(length) {
        this._writingDataChunks = true;
        const dataLength = length;
        const dataOffset = this.offset + this.byteOffset;
        try {
            this._inflator.push(new Uint8Array(this.buffer, dataOffset, dataLength), false);
        }
        catch (error) {
            throw new Error('Error while decompressing the data:', { cause: error });
        }
        this.skip(length);
    }
    decodeFDAT(length) {
        this._writingDataChunks = true;
        let dataLength = length;
        let dataOffset = this.offset + this.byteOffset;
        dataOffset += 4;
        dataLength -= 4;
        try {
            this._inflator.push(new Uint8Array(this.buffer, dataOffset, dataLength), false);
        }
        catch (error) {
            throw new Error('Error while decompressing the data:', { cause: error });
        }
        this.skip(length);
    }
    // https://www.w3.org/TR/PNG/#11tRNS
    decodetRNS(length) {
        switch (this._colorType) {
            case ColorType.GREYSCALE:
            case ColorType.TRUECOLOUR: {
                if (length % 2 !== 0) {
                    throw new RangeError(`tRNS chunk length must be a multiple of 2. Got ${length}`);
                }
                if (length / 2 > this._png.width * this._png.height) {
                    throw new Error(`tRNS chunk contains more alpha values than there are pixels (${length / 2} vs ${this._png.width * this._png.height})`);
                }
                this._hasTransparency = true;
                this._transparency = new Uint16Array(length / 2);
                for (let i = 0; i < length / 2; i++) {
                    this._transparency[i] = this.readUint16();
                }
                break;
            }
            case ColorType.INDEXED_COLOUR: {
                if (length > this._palette.length) {
                    throw new Error(`tRNS chunk contains more alpha values than there are palette colors (${length} vs ${this._palette.length})`);
                }
                let i = 0;
                for (; i < length; i++) {
                    const alpha = this.readByte();
                    this._palette[i].push(alpha);
                }
                for (; i < this._palette.length; i++) {
                    this._palette[i].push(255);
                }
                break;
            }
            // Kept for exhaustiveness.
            /* eslint-disable unicorn/no-useless-switch-case */
            case ColorType.UNKNOWN:
            case ColorType.GREYSCALE_ALPHA:
            case ColorType.TRUECOLOUR_ALPHA:
            default: {
                throw new Error(`tRNS chunk is not supported for color type ${this._colorType}`);
            }
            /* eslint-enable unicorn/no-useless-switch-case */
        }
    }
    // https://www.w3.org/TR/PNG/#11iCCP
    decodeiCCP(length) {
        const name = readKeyword(this);
        const compressionMethod = this.readUint8();
        if (compressionMethod !== CompressionMethod.DEFLATE) {
            throw new Error(`Unsupported iCCP compression method: ${compressionMethod}`);
        }
        const compressedProfile = this.readBytes(length - name.length - 2);
        this._png.iccEmbeddedProfile = {
            name,
            profile: unzlibSync(compressedProfile),
        };
    }
    // https://www.w3.org/TR/PNG/#11pHYs
    decodepHYs() {
        const ppuX = this.readUint32();
        const ppuY = this.readUint32();
        const unitSpecifier = this.readByte();
        this._png.resolution = {
            x: ppuX,
            y: ppuY,
            unit: unitSpecifier,
        };
    }
    decodeApngImage() {
        this._apng.width = this._png.width;
        this._apng.height = this._png.height;
        this._apng.channels = this._png.channels;
        this._apng.depth = this._png.depth;
        this._apng.numberOfFrames = this._numberOfFrames;
        this._apng.numberOfPlays = this._numberOfPlays;
        this._apng.text = this._png.text;
        this._apng.resolution = this._png.resolution;
        for (let i = 0; i < this._numberOfFrames; i++) {
            const newFrame = {
                sequenceNumber: this._frames[i].sequenceNumber,
                delayNumber: this._frames[i].delayNumber,
                delayDenominator: this._frames[i].delayDenominator,
                data: this._apng.depth === 8
                    ? new Uint8Array(this._apng.width * this._apng.height * this._apng.channels)
                    : new Uint16Array(this._apng.width * this._apng.height * this._apng.channels),
            };
            const frame = this._frames.at(i);
            if (frame) {
                frame.data = decodeInterlaceNull({
                    data: frame.data,
                    width: frame.width,
                    height: frame.height,
                    channels: this._apng.channels,
                    depth: this._apng.depth,
                });
                if (this._hasPalette) {
                    this._apng.palette = this._palette;
                }
                if (this._hasTransparency) {
                    this._apng.transparency = this._transparency;
                }
                if (i === 0 ||
                    (frame.xOffset === 0 &&
                        frame.yOffset === 0 &&
                        frame.width === this._png.width &&
                        frame.height === this._png.height)) {
                    newFrame.data = frame.data;
                }
                else {
                    const prevFrame = this._apng.frames.at(i - 1);
                    this.disposeFrame(frame, prevFrame, newFrame);
                    this.addFrameDataToCanvas(newFrame, frame);
                }
                this._apng.frames.push(newFrame);
            }
        }
        return this._apng;
    }
    disposeFrame(frame, prevFrame, imageFrame) {
        switch (frame.disposeOp) {
            case DisposeOpType.NONE:
                break;
            case DisposeOpType.BACKGROUND:
                for (let row = 0; row < this._png.height; row++) {
                    for (let col = 0; col < this._png.width; col++) {
                        const index = (row * frame.width + col) * this._png.channels;
                        for (let channel = 0; channel < this._png.channels; channel++) {
                            imageFrame.data[index + channel] = 0;
                        }
                    }
                }
                break;
            case DisposeOpType.PREVIOUS:
                imageFrame.data.set(prevFrame.data);
                break;
            default:
                throw new Error('Unknown disposeOp');
        }
    }
    addFrameDataToCanvas(imageFrame, frame) {
        const maxValue = 1 << this._png.depth;
        const calculatePixelIndices = (row, col) => {
            const index = ((row + frame.yOffset) * this._png.width + frame.xOffset + col) *
                this._png.channels;
            const frameIndex = (row * frame.width + col) * this._png.channels;
            return { index, frameIndex };
        };
        switch (frame.blendOp) {
            case BlendOpType.SOURCE:
                for (let row = 0; row < frame.height; row++) {
                    for (let col = 0; col < frame.width; col++) {
                        const { index, frameIndex } = calculatePixelIndices(row, col);
                        for (let channel = 0; channel < this._png.channels; channel++) {
                            imageFrame.data[index + channel] =
                                frame.data[frameIndex + channel];
                        }
                    }
                }
                break;
            // https://www.w3.org/TR/png-3/#13Alpha-channel-processing
            case BlendOpType.OVER:
                for (let row = 0; row < frame.height; row++) {
                    for (let col = 0; col < frame.width; col++) {
                        const { index, frameIndex } = calculatePixelIndices(row, col);
                        for (let channel = 0; channel < this._png.channels; channel++) {
                            const sourceAlpha = frame.data[frameIndex + this._png.channels - 1] / maxValue;
                            const foregroundValue = channel % (this._png.channels - 1) === 0
                                ? 1
                                : frame.data[frameIndex + channel];
                            const value = Math.floor(sourceAlpha * foregroundValue +
                                (1 - sourceAlpha) * imageFrame.data[index + channel]);
                            imageFrame.data[index + channel] += value;
                        }
                    }
                }
                break;
            default:
                throw new Error('Unknown blendOp');
        }
    }
    decodeImage() {
        const data = this._inflatorResult;
        if (this._filterMethod !== FilterMethod.ADAPTIVE) {
            throw new Error(`Filter method ${this._filterMethod} not supported`);
        }
        if (this._interlaceMethod === InterlaceMethod.NO_INTERLACE) {
            this._png.data = decodeInterlaceNull({
                data,
                width: this._png.width,
                height: this._png.height,
                channels: this._png.channels,
                depth: this._png.depth,
            });
        }
        else if (this._interlaceMethod === InterlaceMethod.ADAM7) {
            this._png.data = decodeInterlaceAdam7({
                data,
                width: this._png.width,
                height: this._png.height,
                channels: this._png.channels,
                depth: this._png.depth,
            });
        }
        else {
            throw new Error(`Interlace method ${this._interlaceMethod} not supported`);
        }
        if (this._hasPalette) {
            this._png.palette = this._palette;
        }
        if (this._hasTransparency) {
            this._png.transparency = this._transparency;
        }
    }
    pushDataToFrame() {
        // Finalize the current stream
        this._inflator.push(new Uint8Array(0), true); // This triggers final=true in callback
        const result = this._inflatorResult;
        const lastFrame = this._frames.at(-1);
        if (lastFrame) {
            lastFrame.data = result;
        }
        else {
            this._frames.push({
                sequenceNumber: 0,
                width: this._png.width,
                height: this._png.height,
                xOffset: 0,
                yOffset: 0,
                delayNumber: 0,
                delayDenominator: 0,
                disposeOp: DisposeOpType.NONE,
                blendOp: BlendOpType.SOURCE,
                data: result,
            });
        }
        // Create new inflator for next frame
        this._inflator = new Unzlib((chunk, final) => {
            this._chunks.push(chunk);
            if (final) {
                const totalLength = this._chunks.reduce((sum, c) => sum + c.length, 0);
                this._inflatorResult = new Uint8Array(totalLength);
                let offset = 0;
                for (const chunk of this._chunks) {
                    this._inflatorResult.set(chunk, offset);
                    offset += chunk.length;
                }
                this._chunks = [];
            }
        });
        this._chunks = [];
        this._writingDataChunks = false;
    }
}
function checkBitDepth(value) {
    if (value !== 1 &&
        value !== 2 &&
        value !== 4 &&
        value !== 8 &&
        value !== 16) {
        throw new Error(`invalid bit depth: ${value}`);
    }
    return value;
}

function decodePng(data, options) {
    const decoder = new PngDecoder(data, options);
    return decoder.decode();
}

/**
 * @fileOverview
 * @author Ramon Wijnands - rayman747@hotmail.com
 */
const textDecoder = new TextDecoder();
/**
 * If a message was compressed as a PNG image (a compression hack since
 * gzipping over WebSockets * is not supported yet), this function decodes
 * the "image" as a Base64 string.
 *
 * @param data - An object containing the PNG data.
 */
function decompressPng(data) {
    const buffer = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
    const decoded = tryDecodeBuffer(buffer);
    try {
        return JSON.parse(textDecoder.decode(decoded.data));
    }
    catch (error) {
        throw new Error("Error parsing PNG JSON contents", { cause: error });
    }
}
function tryDecodeBuffer(buffer) {
    try {
        return decodePng(buffer);
    }
    catch (error) {
        throw new Error("Error decoding PNG buffer", { cause: error });
    }
}

class Ros extends EventEmitter {
    constructor(options = {}) {
        super();
        this.socket = null;
        this._isConnected = false;
        this.idCounter = 0;
        this.options = options;
        if (options.url) {
            this.connect(options.url);
        }
    }
    get isConnected() {
        return this._isConnected;
    }
    connect(url) {
        var _a, _b;
        if (this.socket && this.socket.readyState === WebSocket.OPEN && this.socket.url === url) {
            return;
        }
        if (this.socket) {
            this.close();
        }
        try {
            const WS = (_b = (_a = this.options) === null || _a === void 0 ? void 0 : _a.WebSocket) !== null && _b !== void 0 ? _b : WebSocket;
            this.socket = new WS(url);
            this.socket.onopen = () => {
                this._isConnected = true;
                this.emit('connection');
            };
            this.socket.onclose = () => {
                this._isConnected = false;
                this.emit('close');
            };
            this.socket.onerror = (error) => {
                this.emit('error', error);
            };
            this.socket.onmessage = (event) => {
                var message = JSON.parse(typeof event === 'string' ? event : event.data);
                this.handlePng(message);
            };
        }
        catch (error) {
            this.emit('error', error);
        }
    }
    close() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this._isConnected = false;
    }
    handleMessage(message) {
        try {
            if (message.op === 'publish') {
                // 发布消息到对应的 topic
                this.emit(message.topic, message.msg);
            }
            else if (message.op === 'service_response') {
                // 服务响应
                this.emit(message.id, message);
            }
            else if (message.op === 'status') {
                // 状态消息
                if (message.id) {
                    this.emit('status:' + message.id, message);
                }
                else {
                    this.emit('status', message);
                }
            }
        }
        catch (error) {
            console.error('Error parsing message:', error);
        }
    }
    handlePng(message) {
        if (message.op === 'png') {
            this.handleMessage(decompressPng(message.data));
        }
        else {
            this.handleMessage(message);
        }
    }
    callOnConnection(message) {
        const messageStr = JSON.stringify(message);
        if (this._isConnected && this.socket) {
            this.socket.send(messageStr);
        }
        else {
            // 等待连接建立后发送
            this.once('connection', () => {
                if (this.socket) {
                    this.socket.send(messageStr);
                }
            });
        }
    }
    getNextId() {
        return (++this.idCounter).toString();
    }
}

/**
 * 事件发射器，用于内部实现
 */
/**
 * 连接状态枚举
 */
var EnhancedRosState;
(function (EnhancedRosState) {
    /** 空闲/初始状态 */
    EnhancedRosState["IDLE"] = "IDLE";
    /** 正在连接 */
    EnhancedRosState["CONNECTING"] = "CONNECTING";
    /** 已连接 */
    EnhancedRosState["CONNECTED"] = "CONNECTED";
    /** 正在重连 */
    EnhancedRosState["RECONNECTING"] = "RECONNECTING";
    /** 已手动关闭 */
    EnhancedRosState["CLOSED"] = "CLOSED";
    /** 发生错误 */
    EnhancedRosState["ERROR"] = "ERROR";
})(EnhancedRosState || (EnhancedRosState = {}));
/**
 * 增强版 ROS 连接封装
 * 支持自动重连、心跳保活、消息队列、状态管理
 */
class EnhancedRos extends EventEmitter {
    /**
     * 构造函数
     * @param options 配置项
     */
    constructor(options = {}) {
        var _a, _b, _c;
        super();
        /** WebSocket 实例 */
        this.socket = null;
        /** 自增 ID 计数器，用于请求-响应匹配 */
        this.idCounter = 0;
        /** 当前连接状态 */
        this._state = EnhancedRosState.IDLE;
        /** 当前/最近一次连接地址 */
        this.currentUrl = null;
        /** 离线消息队列，连接成功后自动发送 */
        this.messageQueue = [];
        /** 重连定时器句柄 */
        this.reconnectTimer = null;
        /** 心跳定时器句柄 */
        this.heartbeatTimer = null;
        /** 最近一次收到服务端消息的时间戳 */
        this.lastServerMessageAtMs = null;
        /** 标记是否为用户主动关闭（影响重连策略） */
        this.manualClose = false;
        /** 连接代际，用于丢弃过期的重连任务 */
        this.connectGeneration = 0;
        this.options = options;
        // 初始化重连退避参数
        this.reconnectMinDelayMs = (_a = options.reconnect_min_delay) !== null && _a !== void 0 ? _a : 1000;
        this.reconnectMaxDelayMs = (_b = options.reconnect_max_delay) !== null && _b !== void 0 ? _b : 30000;
        this.reconnectDelayMs = this.reconnectMinDelayMs;
        // 初始化心跳参数 开启的话12000ms，不开启0ms
        this.heartbeatIntervalMs = (_c = options.heartbeat_interval_ms) !== null && _c !== void 0 ? _c : 0;
        this.heartbeatFn = options.heartbeat_fn;
        // 如果提供了 url，立即开始连接
        if (options.url) {
            this.connect(options.url);
        }
    }
    /** 获取当前状态 */
    get state() {
        return this._state;
    }
    /** 是否已连接 */
    get isConnected() {
        return this._state === EnhancedRosState.CONNECTED;
    }
    /**
     * 建立连接（如已连接相同地址则忽略）
     * @param url WebSocket 地址，例如 ws://localhost:9090
     */
    connect(url) {
        // 避免重复连接相同地址
        if (this.currentUrl === url &&
            (this._state === EnhancedRosState.CONNECTING || this._state === EnhancedRosState.CONNECTED)) {
            return;
        }
        // 进入新一轮连接生命周期
        this.connectGeneration += 1;
        this.cleanupForConnect();
        this.currentUrl = url;
        this.manualClose = false;
        this.setState(EnhancedRosState.IDLE);
        this.setState(EnhancedRosState.CONNECTING);
        this.openSocket(url);
    }
    /**
     * 手动关闭连接（不会触发自动重连）
     */
    close() {
        this.connectGeneration += 1;
        this.manualClose = true;
        this.clearReconnectTimer();
        this.stopHeartbeat();
        this.messageQueue = [];
        this.setState(EnhancedRosState.CLOSED);
        this.closeSocket();
    }
    /**
     * 发送消息（离线时自动入队）
     * @param message 任意 JSON 兼容对象
     */
    callOnConnection(message) {
        if (this._state !== EnhancedRosState.CONNECTED || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
            this.messageQueue.push(message);
            return;
        }
        this.send(message);
    }
    /**
     * 获取下一个自增 ID（字符串形式）
     */
    getNextId() {
        return (++this.idCounter).toString();
    }
    /* ===================== 私有方法 ===================== */
    /** 状态变更并对外广播 */
    setState(next) {
        if (this._state === next)
            return;
        this._state = next;
        this.emit('state', next);
    }
    /** 连接前清理资源 */
    cleanupForConnect() {
        this.clearReconnectTimer();
        this.stopHeartbeat();
        this.closeSocket();
        this.messageQueue = [];
        this.reconnectDelayMs = this.reconnectMinDelayMs;
        this.lastServerMessageAtMs = null;
    }
    /** 清除重连定时器 */
    clearReconnectTimer() {
        if (!this.reconnectTimer)
            return;
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
    }
    /** 创建并绑定 WebSocket 事件 */
    openSocket(url) {
        var _a, _b;
        try {
            const WS = (_b = (_a = this.options) === null || _a === void 0 ? void 0 : _a.WebSocket) !== null && _b !== void 0 ? _b : WebSocket;
            this.socket = new WS(url);
            const generation = this.connectGeneration; // 捕获当前代际
            this.socket.onopen = () => {
                // 连接成功，重置退避
                this.reconnectDelayMs = this.reconnectMinDelayMs;
                this.lastServerMessageAtMs = Date.now();
                this.setState(EnhancedRosState.CONNECTED);
                this.emit('connection');
                this.startHeartbeat();
                this.flushQueue();
            };
            this.socket.onclose = () => {
                if (generation !== this.connectGeneration)
                    return;
                this.stopHeartbeat();
                this.socket = null;
                this.emit('close');
                if (this.manualClose) {
                    // 用户主动关闭，不再重连
                    this.setState(EnhancedRosState.CLOSED);
                    return;
                }
                // 异常断开，进入重连逻辑
                this.setState(EnhancedRosState.RECONNECTING);
                this.scheduleReconnect();
            };
            this.socket.onerror = (error) => {
                this.emit('error', error);
                if (!this.manualClose && this._state === EnhancedRosState.CONNECTING) {
                    // 连接阶段出错，准备重连
                    this.setState(EnhancedRosState.RECONNECTING);
                }
            };
            this.socket.onmessage = (event) => {
                this.lastServerMessageAtMs = Date.now();
                var message = JSON.parse(typeof event === 'string' ? event : event.data);
                this.handlePng(message);
            };
        }
        catch (error) {
            this.emit('error', error);
            this.setState(EnhancedRosState.ERROR);
        }
    }
    /** 安全关闭 WebSocket */
    closeSocket() {
        if (!this.socket)
            return;
        try {
            this.socket.close();
        }
        finally {
            this.socket = null;
        }
    }
    /** 调度下一次重连（退避策略，达到最大后固定） */
    scheduleReconnect() {
        if (!this.currentUrl) {
            this.setState(EnhancedRosState.ERROR);
            return;
        }
        const generation = this.connectGeneration;
        const delayMs = this.reconnectDelayMs;
        this.clearReconnectTimer();
        this.reconnectTimer = setTimeout(() => {
            if (this.manualClose)
                return;
            if (generation !== this.connectGeneration)
                return; // 连接已过期
            if (this._state !== EnhancedRosState.RECONNECTING)
                return;
            if (!this.currentUrl) {
                this.setState(EnhancedRosState.ERROR);
                return;
            }
            // 进入新一轮连接生命周期
            // this.connectGeneration += 1;
            // 不能 this.cleanupForConnect(); 
            // 关闭定时器、清除socket在close时候已经处理； 连接上后自然会重置 this.reconnectDelayMs = this.reconnectMinDelayMs; this.lastServerMessageAtMs = null;
            // 现在讨论是否要不要connectGeneration++ ，我认为是有必要的，每一次重连都是一个新的socket
            // 不能 清空messageQueue，messageQueue还等着重连成功自动重发
            this.connectGeneration += 1;
            this.setState(EnhancedRosState.CONNECTING);
            this.openSocket(this.currentUrl);
            // 退避：下次等待时间翻倍，直到上限后固定
            if (this.reconnectDelayMs < this.reconnectMaxDelayMs) {
                this.reconnectDelayMs = Math.min(this.reconnectMaxDelayMs, this.reconnectDelayMs * 2);
            }
            // 已达上限，保持最大延迟不变，持续重试
        }, delayMs);
    }
    /** 启动心跳定时器 */
    startHeartbeat() {
        this.stopHeartbeat();
        if (this.heartbeatIntervalMs <= 0)
            return;
        this.heartbeatTimer = setInterval(() => {
            if (this._state !== EnhancedRosState.CONNECTED)
                return;
            if (!this.socket || this.socket.readyState !== WebSocket.OPEN)
                return;
            const now = Date.now();
            const last = this.lastServerMessageAtMs;
            // 超过两倍心跳间隔未收到消息，认为连接失效
            if (last && now - last > this.heartbeatIntervalMs * 2) {
                this.setState(EnhancedRosState.RECONNECTING);
                try {
                    this.closeSocket();
                }
                catch (_a) { }
                // if (!this.reconnectTimer) {
                //   this.scheduleReconnect();
                // }
                return;
            }
            // 发送 ping 保活
            if (this.heartbeatFn) {
                this.heartbeatFn();
            }
            else {
                /// 默认心跳：调用 /rosapi/get_time 服务
                this.cast({ op: "call_service", id: this.getNextId(), service: "/rosapi/get_time", type: "rosapi/GetTime", args: {} });
            }
        }, this.heartbeatIntervalMs);
    }
    /** 停止心跳定时器 */
    stopHeartbeat() {
        if (!this.heartbeatTimer)
            return;
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
    }
    /** 将离线队列全部发出 */
    flushQueue() {
        if (this._state !== EnhancedRosState.CONNECTED || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
        }
        if (this.messageQueue.length === 0)
            return;
        const pending = this.messageQueue;
        this.messageQueue = [];
        for (const msg of pending) {
            this.send(msg);
        }
    }
    /** 真正发送 JSON 字符串 */
    send(message) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            // 兜底：万一状态不一致，重新入队
            this.messageQueue.push(message);
            return;
        }
        const messageStr = JSON.stringify(message);
        this.socket.send(messageStr);
    }
    cast(message) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
        }
        const messageStr = JSON.stringify(message);
        this.socket.send(messageStr);
    }
    /** 解析并分发服务端消息 */
    handleMessage(message) {
        try {
            if (message.op === 'publish') {
                // 普通话题消息
                this.emit(message.topic, message.msg);
            }
            else if (message.op === 'service_response') {
                // 服务响应，用 id 匹配请求
                this.emit(message.id, message);
            }
            else if (message.op === 'status') {
                // 状态消息，可选带 id
                if (message.id) {
                    this.emit('status:' + message.id, message);
                }
                else {
                    this.emit('status', message);
                }
            }
            else if (message.op === 'service_request') {
                // 服务请求（作为服务端角色时）
                this.emit('service_request:' + message.service, message);
            }
        }
        catch (error) {
            console.error('Error parsing message:', error);
        }
    }
    handlePng(message) {
        if (message.op === 'png') {
            this.handleMessage(decompressPng(message.data));
        }
        else {
            this.handleMessage(message);
        }
    }
}

class Topic extends EventEmitter {
    constructor(options) {
        super();
        this.isSubscribed = false;
        this.isAdvertised = false;
        /** 内部状态处理：连接关闭时重置标志位 */
        this._handleClose = () => {
            this.isSubscribed = false;
            this.isAdvertised = false;
        };
        this.ros = options.ros;
        this.name = options.name;
        this.messageType = options.messageType;
        this.compression = options.compression;
        this.throttle_rate = options.throttle_rate;
        this.queue_size = options.queue_size;
        this.latch = options.latch;
        this.queue_length = options.queue_length;
        // 预定义重连逻辑
        this._reconnectHandler = () => {
            if (this.isSubscribed) {
                this._sendSubscribe();
            }
            if (this.isAdvertised) {
                this._sendAdvertise();
            }
        };
    }
    /** 发送底层的订阅协议包 */
    _sendSubscribe() {
        this.isSubscribed = true;
        const subscribeMessage = Object.assign(Object.assign(Object.assign({ op: "subscribe", id: "subscribe:" + this.name + ":" + this.ros.getNextId(), topic: this.name, type: this.messageType }, (this.compression && { compression: this.compression })), (this.throttle_rate && { throttle_rate: this.throttle_rate })), (this.queue_length && { queue_length: this.queue_length }));
        this.ros.callOnConnection(subscribeMessage);
    }
    /** 发送底层的公告协议包 */
    _sendAdvertise() {
        this.isAdvertised = true;
        this.advertiseId = "advertise:" + this.name + ":" + this.ros.getNextId();
        const advertiseMessage = Object.assign(Object.assign({ op: "advertise", id: this.advertiseId, topic: this.name, type: this.messageType }, (this.latch && { latch: this.latch })), (this.queue_size && { queue_size: this.queue_size }));
        this.ros.callOnConnection(advertiseMessage);
    }
    /**
     * 订阅话题
     * @param callback 接收消息的回调函数
     */
    subscribe(callback) {
        if (this.isSubscribed)
            return;
        // 1. 先尝试移除已有的监听，防止重复挂载
        this.ros.off("connection", this._reconnectHandler);
        this.ros.off("close", this._handleClose);
        // 2. 挂载监听
        this.ros.on("connection", this._reconnectHandler);
        this.ros.on("close", this._handleClose);
        // 3. 执行物理订阅
        this._sendSubscribe();
        // 4. 监听来自 ROS 的消息分发
        this.ros.on(this.name, (message) => {
            this.emit("message", message);
            if (callback)
                callback(message);
        });
    }
    /** 取消订阅 */
    unsubscribe() {
        if (!this.isSubscribed)
            return;
        const unsubscribeMessage = {
            op: "unsubscribe",
            topic: this.name,
        };
        this.ros.callOnConnection(unsubscribeMessage);
        this.isSubscribed = false;
        // 彻底清理：移除重连监听和消息监听
        this.ros.off(this.name);
        if (!this.isAdvertised) {
            this.ros.off("connection", this._reconnectHandler);
            this.ros.off("close", this._handleClose);
        }
    }
    /** 公告话题（作为发布者） */
    advertise() {
        if (this.isAdvertised)
            return;
        this.ros.off("connection", this._reconnectHandler);
        this.ros.on("connection", this._reconnectHandler);
        this.ros.on("close", this._handleClose);
        this._sendAdvertise();
    }
    /** 取消公告 */
    unadvertise() {
        if (!this.isAdvertised)
            return;
        const unadvertiseMessage = {
            op: "unadvertise",
            id: this.advertiseId,
            topic: this.name,
        };
        this.ros.callOnConnection(unadvertiseMessage);
        this.isAdvertised = false;
        // 如果当前也没有订阅，则可以安全移除重连处理器
        if (!this.isSubscribed) {
            this.ros.off("connection", this._reconnectHandler);
            this.ros.off("close", this._handleClose);
        }
    }
    /** 发布消息 */
    publish(message) {
        if (!this.isAdvertised) {
            this.advertise();
        }
        const publishMessage = {
            op: "publish",
            id: "publish:" + this.name + ":" + this.ros.getNextId(),
            topic: this.name,
            msg: message,
            latch: this.latch,
        };
        this.ros.callOnConnection(publishMessage);
    }
}

class ServiceRequest {
    constructor(values) {
        if (values) {
            Object.assign(this, values);
        }
    }
}
class ServiceResponse {
    constructor(values) {
        if (values) {
            Object.assign(this, values);
        }
    }
}

class Service extends EventEmitter {
    constructor(options) {
        super();
        this.isAdvertised = false;
        /** 存储服务请求处理函数，便于卸载 */
        this._currentServiceCallback = null;
        /** 内部状态处理：连接关闭时重置标志位 */
        this._handleClose = () => {
            this.isAdvertised = false;
        };
        this.ros = options.ros;
        this.name = options.name;
        this.serviceType = options.serviceType;
        // 预定义重连恢复逻辑
        this._reconnectHandler = () => {
            if (this.isAdvertised && this._currentServiceCallback) {
                this._sendAdvertise();
            }
        };
    }
    callService(request, callback, failedCallback) {
        return new Promise((resolve, reject) => {
            const serviceId = this.ros.getNextId();
            const serviceMessage = {
                op: 'call_service',
                id: serviceId,
                service: this.name,
                type: this.serviceType,
                args: request
            };
            // 监听服务响应
            const responseHandler = (message) => {
                var _a;
                if (message.id === serviceId) {
                    this.ros.off(serviceId, responseHandler);
                    // rosbridge-level error
                    if (message.result === false) {
                        const error = new Error(message.error || `Service ${this.name} call failed`);
                        failedCallback === null || failedCallback === void 0 ? void 0 : failedCallback(error);
                        reject(error);
                        return;
                    }
                    // protocol error
                    if (message.result === undefined) {
                        const error = new Error('Invalid service response');
                        failedCallback === null || failedCallback === void 0 ? void 0 : failedCallback(error);
                        reject(error);
                        return;
                    }
                    // success
                    const response = new ServiceResponse((_a = message.values) !== null && _a !== void 0 ? _a : {});
                    callback === null || callback === void 0 ? void 0 : callback(response);
                    resolve(response);
                }
            };
            this.ros.on(serviceId, responseHandler);
            this.ros.callOnConnection(serviceMessage);
        });
    }
    /** 发送底层的服务公告协议 */
    _sendAdvertise() {
        this.isAdvertised = true;
        const advertiseMessage = {
            op: 'advertise_service',
            type: this.serviceType,
            service: this.name
        };
        this.ros.callOnConnection(advertiseMessage);
    }
    /**
     * 公告服务（服务端模式）
     * @param callback 处理请求并返回结果的回调
     */
    advertise(callback) {
        if (this.isAdvertised)
            return;
        this._currentServiceCallback = callback;
        // 1. 防御性卸载旧监听
        this.ros.off('connection', this._reconnectHandler);
        this.ros.off('close', this._handleClose);
        this.ros.off('service_request:' + this.name);
        // 2. 挂载生命周期监听
        this.ros.on('connection', this._reconnectHandler);
        this.ros.on('close', this._handleClose);
        // 3. 监听服务请求
        this.ros.on('service_request:' + this.name, (message) => {
            const request = new ServiceRequest(message.args);
            const response = new ServiceResponse();
            try {
                const result = callback(request, response);
                const responseMessage = {
                    op: 'service_response',
                    service: this.name,
                    id: message.id,
                    values: response,
                    result: result !== false
                };
                this.ros.callOnConnection(responseMessage);
            }
            catch (error) {
                const errorMessage = {
                    op: 'service_response',
                    service: this.name,
                    id: message.id,
                    result: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
                this.ros.callOnConnection(errorMessage);
            }
        });
        // 4. 执行物理公告
        this._sendAdvertise();
    }
    /**
     * 取消服务公告
     */
    unadvertise() {
        if (!this.isAdvertised)
            return;
        const unadvertiseMessage = {
            op: 'unadvertise_service',
            service: this.name
        };
        this.ros.callOnConnection(unadvertiseMessage);
        this.isAdvertised = false;
        this._currentServiceCallback = null;
        // 彻底清理资源：移除所有相关监听
        this.ros.off('service_request:' + this.name);
        this.ros.off('connection', this._reconnectHandler);
        this.ros.off('close', this._handleClose);
    }
}

class Param {
    constructor(options) {
        this.ros = options.ros;
        this.name = options.name;
    }
    get(callback) {
        return new Promise((resolve, reject) => {
            const service = new Service({
                ros: this.ros,
                name: '/rosapi/get_param',
                serviceType: 'rosapi/GetParam'
            });
            const request = new ServiceRequest({
                name: this.name,
                default: ''
            });
            service.callService(request, (response) => {
                if (callback)
                    callback(response.value);
                resolve(response.value);
            }, (error) => {
                reject(error);
            });
        });
    }
    set(value, callback) {
        return new Promise((resolve, reject) => {
            const service = new Service({
                ros: this.ros,
                name: '/rosapi/set_param',
                serviceType: 'rosapi/SetParam'
            });
            const request = new ServiceRequest({
                name: this.name,
                value: JSON.stringify(value)
            });
            service.callService(request, () => {
                if (callback)
                    callback();
                resolve();
            }, (error) => {
                reject(error);
            });
        });
    }
    delete(callback) {
        return new Promise((resolve, reject) => {
            const service = new Service({
                ros: this.ros,
                name: '/rosapi/delete_param',
                serviceType: 'rosapi/DeleteParam'
            });
            const request = new ServiceRequest({
                name: this.name
            });
            service.callService(request, () => {
                if (callback)
                    callback();
                resolve();
            }, (error) => {
                reject(error);
            });
        });
    }
}

class ActionClient extends EventEmitter {
    constructor(options) {
        super();
        this.receivedStatus = false;
        this.ros = options.ros;
        this.serverName = options.serverName;
        this.actionName = options.actionName;
        this.timeout = options.timeout;
        this.omitFeedback = options.omitFeedback;
        this.omitStatus = options.omitStatus;
        this.omitResult = options.omitResult;
        this.goals = {};
        // create the topics associated with actionlib
        this.feedbackListener = new Topic({
            ros: this.ros,
            name: this.serverName + '/feedback',
            messageType: this.actionName + 'Feedback'
        });
        this.statusListener = new Topic({
            ros: this.ros,
            name: this.serverName + '/status',
            messageType: 'actionlib_msgs/GoalStatusArray'
        });
        this.resultListener = new Topic({
            ros: this.ros,
            name: this.serverName + '/result',
            messageType: this.actionName + 'Result'
        });
        this.goalTopic = new Topic({
            ros: this.ros,
            name: this.serverName + '/goal',
            messageType: this.actionName + 'Goal'
        });
        this.cancelTopic = new Topic({
            ros: this.ros,
            name: this.serverName + '/cancel',
            messageType: 'actionlib_msgs/GoalID'
        });
        // advertise the goal and cancel topics
        this.goalTopic.advertise();
        this.cancelTopic.advertise();
        // subscribe to the status topic
        if (!this.omitStatus) {
            this.statusListener.subscribe((statusMessage) => {
                this.receivedStatus = true;
                if (statusMessage.status_list) {
                    statusMessage.status_list.forEach((status) => {
                        const goal = this.goals[status.goal_id.id];
                        if (goal) {
                            goal.emit('status', status);
                        }
                    });
                }
            });
        }
        // subscribe the the feedback topic
        if (!this.omitFeedback) {
            this.feedbackListener.subscribe((feedbackMessage) => {
                const goal = this.goals[feedbackMessage.status.goal_id.id];
                if (goal) {
                    goal.emit('status', feedbackMessage.status);
                    goal.emit('feedback', feedbackMessage.feedback);
                }
            });
        }
        // subscribe to the result topic
        if (!this.omitResult) {
            this.resultListener.subscribe((resultMessage) => {
                const goal = this.goals[resultMessage.status.goal_id.id];
                if (goal) {
                    goal.emit('status', resultMessage.status);
                    goal.emit('result', resultMessage.result);
                }
            });
        }
        // If timeout specified, emit a 'timeout' event if the action server does not respond
        if (this.timeout) {
            setTimeout(() => {
                if (!this.receivedStatus) {
                    this.emit('timeout');
                }
            }, this.timeout);
        }
    }
    /**
     * Cancel all goals associated with this ActionClient.
     */
    cancel() {
        const cancelMessage = {};
        this.cancelTopic.publish(cancelMessage);
    }
    /**
     * Unsubscribe and unadvertise all topics associated with this ActionClient.
     */
    dispose() {
        this.goalTopic.unadvertise();
        this.cancelTopic.unadvertise();
        if (!this.omitStatus) {
            this.statusListener.unsubscribe();
        }
        if (!this.omitFeedback) {
            this.feedbackListener.unsubscribe();
        }
        if (!this.omitResult) {
            this.resultListener.unsubscribe();
        }
    }
}

class Goal extends EventEmitter {
    constructor(options) {
        super();
        this.isFinished = false;
        this.actionClient = options.actionClient;
        this.goalMessage = options.goalMessage;
        // Used to create random IDs
        const date = new Date();
        // Create a random ID
        this.goalID = 'goal_' + Math.random() + '_' + date.getTime();
        // Fill in the goal message
        this.goalMessage = {
            goal_id: {
                stamp: {
                    secs: 0,
                    nsecs: 0
                },
                id: this.goalID
            },
            goal: this.goalMessage
        };
        this.on('status', (status) => {
            this.status = status;
        });
        this.on('result', (result) => {
            this.isFinished = true;
            this.result = result;
        });
        this.on('feedback', (feedback) => {
            this.feedback = feedback;
        });
        // Add the goal
        this.actionClient.goals[this.goalID] = this;
    }
    /**
     * Send the goal to the action server.
     *
     * @param timeout - A timeout length for the goal's result.
     */
    send(timeout) {
        this.actionClient.goalTopic.publish(this.goalMessage);
        if (timeout) {
            setTimeout(() => {
                if (!this.isFinished) {
                    this.emit('timeout');
                }
            }, timeout);
        }
    }
    /**
     * Cancel the current goal.
     */
    cancel() {
        const cancelMessage = {
            id: this.goalID
        };
        this.actionClient.cancelTopic.publish(cancelMessage);
    }
}

class TopicManager {
    constructor(ros) {
        this.topics = new Map();
        this.pubTopics = new Map();
        this.ros = ros;
    }
    /**
     * 订阅指定主题
     * @param name 主题名称
     * @param messageType 消息类型
     * @param callback 回调函数，当收到消息时调用
     * @param config 订阅配置选项（可选）
     */
    subscribe(name, messageType, callback, config) {
        if (!this.ros) {
            throw new Error("ros instance is not initialized");
        }
        if (!this.ros.isConnected) {
            console.warn(`ROS not connected, cannot subscribe to ${name}, ${name} in messageQueue when ros reconnected`);
        }
        // 已存在，添加回调即可
        if (this.topics.has(name)) {
            const managed = this.topics.get(name);
            managed.callbacks.add(callback);
            return;
        }
        // 创建新 topic
        const topic = new Topic(Object.assign({ ros: this.ros, name, messageType }, config));
        const callbacks = new Set();
        callbacks.add(callback);
        topic.subscribe((msg) => {
            callbacks.forEach((cb) => cb(msg));
        });
        this.topics.set(name, { topic, callbacks, messageType, config });
    }
    unsubscribe(name, callback) {
        const managed = this.topics.get(name);
        if (!managed)
            return;
        if (callback) {
            managed.callbacks.delete(callback);
            // 如果没有回调了，取消订阅
            if (managed.callbacks.size === 0) {
                managed.topic.unsubscribe();
                this.topics.delete(name);
            }
        }
        else {
            // 取消所有订阅
            managed.topic.unsubscribe();
            this.topics.delete(name);
        }
    }
    clearAll() {
        this.topics.forEach((managed) => {
            managed.topic.unsubscribe();
        });
        this.topics.clear();
    }
    resubscribeAll(ros) {
        this.topics.forEach((managed, name) => {
            const topic = new Topic(Object.assign({ ros, name, messageType: managed.messageType }, managed.config));
            managed.topic = topic;
            topic.subscribe((msg) => {
                managed.callbacks.forEach((cb) => cb(msg));
            });
        });
    }
    /**
     * 发布消息到指定主题
     * @param name 主题名称
     * @param messageType 消息类型
     * @param data 要发布的数据
     * @param config 发布配置选项（可选）
     * @param queueWhenOffline 是否在 ROS 连接时队列消息（默认 false）
     * @returns Promise，成功时解析为 undefined，失败时拒绝
     */
    publish(name, messageType, data, config, queueWhenOffline = false) {
        return new Promise((resolve, reject) => {
            if (!this.ros) {
                reject(new Error("ros instance is not initialized"));
                return;
            }
            if (!this.ros.isConnected) {
                if (!queueWhenOffline) {
                    reject(new Error(`ROS not connected, cannot publish to ${name}`));
                    return;
                }
                console.warn(`ROS not connected, cannot publish to ${name}, ${name} in messageQueue when ros reconnected`);
            }
            // 已存在，添加回调即可
            if (this.pubTopics.has(name)) {
                const managed = this.pubTopics.get(name);
                managed.topic.publish(data);
                resolve(undefined);
                return;
            }
            const chatter = new Topic(Object.assign({ ros: this.ros, name,
                messageType }, config));
            this.pubTopics.set(name, {
                topic: chatter,
                messageType,
            });
            chatter.publish(data);
            resolve(undefined);
        });
    }
    unadvertise(name) {
        const managed = this.pubTopics.get(name);
        if (!managed)
            return;
        managed.topic.unadvertise();
        this.pubTopics.delete(name);
    }
    unadvertiseAll() {
        this.pubTopics.forEach((managed) => {
            managed.topic.unadvertise();
        });
        this.pubTopics.clear();
    }
}
class ServiceManager {
    constructor(ros, timeout = 10000) {
        this.defaultTimeout = 10000; // 默认超时 10s
        this.ros = ros;
        this.defaultTimeout = timeout;
    }
    /**
     * 调用服务（每次直接创建 Service 实例，带统一超时）
     * @param name 服务名称
     * @param serviceType 服务类型
     * @param request 服务请求数据（可选）
     * @param timeout 超时时间（默认 10s）
     * @returns Promise，成功时解析为服务响应，失败时拒绝
     */
    call(name, serviceType, request, timeout = this.defaultTimeout) {
        return new Promise((resolve, reject) => {
            if (!this.ros) {
                return reject(new Error("ros instance is not initialized"));
            }
            if (!this.ros.isConnected) {
                return reject(new Error(`ROS not connected, cannot call service ${name}`));
            }
            let timer = null;
            const cleanup = () => {
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
            };
            timer = setTimeout(() => {
                cleanup();
                reject(new Error(`Service call ${name} timeout after ${timeout}ms`));
            }, timeout);
            try {
                const service = new Service({
                    ros: this.ros,
                    name,
                    serviceType,
                });
                const serviceRequest = new ServiceRequest(request);
                service.callService(serviceRequest, (result) => {
                    cleanup();
                    resolve(result);
                }, (error) => {
                    cleanup();
                    reject(error);
                });
            }
            catch (error) {
                cleanup();
                reject(error);
            }
        });
    }
}
class ParamManager {
    constructor(ros, timeout = 10000) {
        this.defaultTimeout = 10000; // 默认超时 10s
        this.ros = ros;
        this.defaultTimeout = timeout;
    }
    /**
     * 获取参数值
     */
    get(name, timeout = this.defaultTimeout) {
        return new Promise((resolve, reject) => {
            const ros = this.ros;
            if (!this.ros) {
                return reject(new Error("ros instance is not initialized"));
            }
            if (!this.ros.isConnected) {
                return reject(new Error(`ROS not connected, cannot get param ${name}`));
            }
            const param = new Param({ ros, name });
            const timer = setTimeout(() => {
                reject(new Error(`Get param ${name} timeout`));
            }, timeout);
            param
                .get((value) => {
                clearTimeout(timer);
                resolve(value);
            })
                .catch((error) => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }
    /**
     * 设置参数值
     */
    set(name, value) {
        return new Promise((resolve, reject) => {
            const ros = this.ros;
            if (!this.ros) {
                return reject(new Error("ros instance is not initialized"));
            }
            if (!this.ros.isConnected) {
                return reject(new Error(`ROS not connected, cannot set param ${name}`));
            }
            const param = new Param({ ros, name });
            param
                .set(value, () => {
                resolve();
            })
                .catch((error) => {
                reject(error);
            });
        });
    }
    /**
     * 删除参数
     */
    delete(name) {
        return new Promise((resolve, reject) => {
            const ros = this.ros;
            if (!this.ros) {
                return reject(new Error("ros instance is not initialized"));
            }
            if (!this.ros.isConnected) {
                return reject(new Error(`ROS not connected, cannot delete param ${name}`));
            }
            const param = new Param({ ros, name });
            param
                .delete(() => {
                resolve();
            })
                .catch((error) => {
                reject(error);
            });
        });
    }
}

export { ActionClient, EnhancedRos, EnhancedRosState, EventEmitter, Goal, Param, ParamManager, Ros, Service, ServiceManager, ServiceRequest, ServiceResponse, Topic, TopicManager };
//# sourceMappingURL=index.esm.js.map
