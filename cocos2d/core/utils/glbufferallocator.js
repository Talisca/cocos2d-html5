//bitfield with 32 bit array internal representation
cc.Bitfield32 = (function () {
    function Bitfield32(size) {
        this.field = new Uint32Array(Math.ceil(size / 32));
    }

    Bitfield32.prototype.clear = function (i) {
        var ri = Math.floor(i / 32); //real i
        var subi = i % 32; //sub index within the bitfield
        this.field[ri] &= ~(1 << subi);
    }

    Bitfield32.prototype.set = function (i) {
        var ri = Math.floor(i / 32); //real i
        var subi = i % 32; //sub index within the bitfield
        this.field[ri] |= (1 << subi);
    }

    Bitfield32.prototype.get = function (i) {
        var ri = Math.floor(i / 32); //real i
        var subi = i % 32; //sub index within the bitfield
        return this.field[ri] & (1 << subi);
    }

    return Bitfield32;
})();

//allocator for fixed-size memory sections in opengl buffers. for example, for lots of small pieces of quad data for sprites
(function () {
    
    //elementByteSize is the size in bytes that each fixed size chunk of the buffer has
    cc.WebGLFixedBufferAllocator = function (elementByteSize) {
        this._elementSize = elementByteSize;
        this._init();
    };

    var p = cc.WebGLFixedBufferAllocator.prototype;

    p._init = function()
    {
        this._buffers = [];

        //create one buffer as a start
        this._createBuffer();
    }

    p._createBuffer = function()
    {
        var buffer = gl.createBuffer();
        var size = this._allocateBuffer(buffer, 2 * 1024 * 1024);  //make it as big as possible, start at 2 mb

        var result = {
            buffer: buffer,
            freeChunks: Math.floor(size / this._elementSize),
            maxChunks: Math.floor(size / this._elementSize),
            nextFreeChunk: 0 //index of the first chunk that is not occupied
        };

        //occupancyBitmap tells us which chunks are taken and which are free (with bitflags)
        result.occupancyBitmap = new cc.Bitfield32(result.freeChunks); 

        this._buffers.push(result);

        return result;
    }

    p._allocateBuffer = function(buffer, preferredByteSize)
    {
        //iteratively asks for smaller buffers if a size request fails
        cc.glBindArrayBuffer(buffer);
        for (var byteSize = preferredByteSize; byteSize >= this._elementSize; byteSize/=2)
        {
            gl.bufferData(gl.ARRAY_BUFFER, byteSize, gl.DYNAMIC_DRAW);

            var error = gl.getError();
            if(error === 0)
            {
                break;
            }
        }

        return byteSize;
    }

    //returns object {buffer, byteOffset} where buffer is the opengl buffer and byteOffset is the byteOffset into the buffer
    p.getBuffer = function()
    {
        var i;
        //find buffer that still has free chunks
        var buffers = this._buffers;
        var data = null;
        for(i=buffers.length-1;i>=0;--i)
        {
            var buf = buffers[i];
            if(buf.freeChunks > 0)
            {
                data = buf;
                break;
            }
        }

        if(data === null) //all buffers full, need new one
        {
            data = this._createBuffer();
        }

        //get free chunk from buffer
        var index = data.nextFreeChunk;
        var byteOffset = index * this._elementSize;

        data.freeChunks--;
        var map = data.occupancyBitmap;
        map.set(index);

        if (data.freeChunks > 0) //look for new free chunk
        {
            var nextFreeChunk = -1;
            var max = data.maxChunks;
            for(i = index+1; i<max; ++i)
            {
                if(map.get(i) === 0)
                {
                    nextFreeChunk = i;
                    break;
                }
            }

            if(nextFreeChunk === -1) //we searched forward and found nothing, now we scan the chunks 'left' of the returned index
            {
                var end = index-1;
                for(i = 0;i<end;++i)
                {
                    if (map.get(i) === 0) {
                        nextFreeChunk = i;
                        break;
                    }
                }
            }

            //nextFreeChunk cannot be -1 here. since all of this only happens if freeChunks > 0 there must be at least one free chunk!
            data.nextFreeChunk = nextFreeChunk;
        }

        var result = {
            buffer: data.buffer,
            byteOffset: byteOffset,
            quadIndex: index,
            _intern: { data: data, chunkIndex: index }
        };

        return result;
    }

    p.freeBuffer = function(buffer)
    {
        var trash = buffer._intern;
        trash.data.occupancyBitmap.clear(trash.chunkIndex);
        trash.data.freeChunks++;
    }
})();