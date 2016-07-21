/****************************************************************************
 Copyright (c) 2008-2010 Ricardo Quesada
 Copyright (c) 2011-2012 cocos2d-x.org
 Copyright (c) 2013-2014 Chukong Technologies Inc.

 http://www.cocos2d-x.org

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

cc._stateCacheStats = {
    vertexFormatSwitches: 0,
    lastFrameVertexFormatSwitches: 0
};

cc._currentProjectionMatrix = -1;
cc._vertexAttribPosition = false;
cc._vertexAttribColor = false;
cc._vertexAttribTexCoords = false;

if (cc.ENABLE_GL_STATE_CACHE) {
    cc.MAX_ACTIVETEXTURE = 16;

    cc._currentShaderProgram = -1;
    cc._currentBoundTexture = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1];
    cc._blendingSource = -1;
    cc._blendingDest = -1;
    cc._GLServerState = 0;
    if(cc.TEXTURE_ATLAS_USE_VAO)
        cc._uVAO = 0;
}

// GL State Cache functions

/**
 * Invalidates the GL state cache.<br/>
 * If CC_ENABLE_GL_STATE_CACHE it will reset the GL state cache.
 * @function
 */
cc.glInvalidateStateCache = function () {
    cc.kmGLFreeAll();
    cc._currentProjectionMatrix = -1;
    cc._vertexAttribPosition = false;
    cc._vertexAttribColor = false;
    cc._vertexAttribTexCoords = false;
    if (cc.ENABLE_GL_STATE_CACHE) {
        cc._currentShaderProgram = -1;
        for (var i = 0; i < cc.MAX_ACTIVETEXTURE; i++) {
            cc._currentBoundTexture[i] = -1;
        }
        cc._blendingSource = -1;
        cc._blendingDest = -1;
        cc._GLServerState = 0;
    }
};

/**
 * Uses the GL program in case program is different than the current one.<br/>
 * If CC_ENABLE_GL_STATE_CACHE is disabled, it will the glUseProgram() directly.
 * @function
 * @param {WebGLProgram} program
 */
cc.glUseProgram = function (program) {
    if (program !== cc._currentShaderProgram) {
        cc._currentShaderProgram = program;
        gl.useProgram(program);
    }
};

if(!cc.ENABLE_GL_STATE_CACHE){
    cc.glUseProgram = function (program) {
        gl.useProgram(program);
    }
}

/**
 * Deletes the GL program. If it is the one that is being used, it invalidates it.<br/>
 * If CC_ENABLE_GL_STATE_CACHE is disabled, it will the glDeleteProgram() directly.
 * @function
 * @param {WebGLProgram} program
 */
cc.glDeleteProgram = function (program) {
    if (cc.ENABLE_GL_STATE_CACHE) {
        if (program === cc._currentShaderProgram)
            cc._currentShaderProgram = -1;
    }
    gl.deleteProgram(program);
};

/**
 * Uses a blending function in case it not already used.<br/>
 * If CC_ENABLE_GL_STATE_CACHE is disabled, it will the glBlendFunc() directly.
 * @function
 * @param {Number} sfactor
 * @param {Number} dfactor
 */
cc.glBlendFunc = function (sfactor, dfactor) {
    if ((sfactor !== cc._blendingSource) || (dfactor !== cc._blendingDest)) {
        cc._blendingSource = sfactor;
        cc._blendingDest = dfactor;
        cc.setBlending(sfactor, dfactor);
    }
};

/**
 * @function
 * @param {Number} sfactor
 * @param {Number} dfactor
 */
cc.setBlending = function (sfactor, dfactor) {
    var ctx = gl;
    if ((sfactor === ctx.ONE) && (dfactor === ctx.ZERO)) {
        ctx.disable(ctx.BLEND);
    } else {
        ctx.enable(ctx.BLEND);
        gl.blendFunc(sfactor,dfactor);
        //TODO need fix for WebGL
        //ctx.blendFuncSeparate(ctx.SRC_ALPHA, dfactor, sfactor, dfactor);
    }
};

/**
 * @function
 * @param {Number} sfactor
 * @param {Number} dfactor
 */
cc.glBlendFuncForParticle = function(sfactor, dfactor) {
    if ((sfactor !== cc._blendingSource) || (dfactor !== cc._blendingDest)) {
        cc._blendingSource = sfactor;
        cc._blendingDest = dfactor;
        var ctx = gl;
        if ((sfactor === ctx.ONE) && (dfactor === ctx.ZERO)) {
            ctx.disable(ctx.BLEND);
        } else {
            ctx.enable(ctx.BLEND);
            //TODO need fix for WebGL
            ctx.blendFuncSeparate(ctx.SRC_ALPHA, dfactor, sfactor, dfactor);
        }
    }
};

if(!cc.ENABLE_GL_STATE_CACHE){
    cc.glBlendFunc = cc.setBlending;
};

/**
 * Resets the blending mode back to the cached state in case you used glBlendFuncSeparate() or glBlendEquation().<br/>
 * If CC_ENABLE_GL_STATE_CACHE is disabled, it will just set the default blending mode using GL_FUNC_ADD.
 * @function
 */
cc.glBlendResetToCache = function () {
    var ctx = gl;
    ctx.blendEquation(ctx.FUNC_ADD);
    if (cc.ENABLE_GL_STATE_CACHE)
        cc.setBlending(cc._blendingSource, cc._blendingDest);
    else
        cc.setBlending(ctx.BLEND_SRC, ctx.BLEND_DST);
};

/**
 * sets the projection matrix as dirty
 * @function
 */
cc.setProjectionMatrixDirty = function () {
    cc._currentProjectionMatrix = -1;
};

/**
 * <p>
 *    Will enable the vertex attribs that are passed as flags.  <br/>
 *    Possible flags:                                           <br/>
 *    cc.VERTEX_ATTRIB_FLAG_POSITION                             <br/>
 *    cc.VERTEX_ATTRIB_FLAG_COLOR                                <br/>
 *    cc.VERTEX_ATTRIB_FLAG_TEX_COORDS                            <br/>
 *                                                              <br/>
 *    These flags can be ORed. The flags that are not present, will be disabled.
 * </p>
 * @function
 * @param {cc.VERTEX_ATTRIB_FLAG_POSITION | cc.VERTEX_ATTRIB_FLAG_COLOR | cc.VERTEX_ATTRIB_FLAG_TEX_OORDS} flags
 */
cc.glEnableVertexAttribs = function (flags) {
    /* Position */
    var ctx = gl;
    var enablePosition = ( flags & cc.VERTEX_ATTRIB_FLAG_POSITION );
    if (enablePosition !== cc._vertexAttribPosition) {
        if (enablePosition)
            ctx.enableVertexAttribArray(cc.VERTEX_ATTRIB_POSITION);
        else
            ctx.disableVertexAttribArray(cc.VERTEX_ATTRIB_POSITION);
        cc._vertexAttribPosition = enablePosition;
    }

    /* Color */
    var enableColor = (flags & cc.VERTEX_ATTRIB_FLAG_COLOR);
    if (enableColor !== cc._vertexAttribColor) {
        if (enableColor)
            ctx.enableVertexAttribArray(cc.VERTEX_ATTRIB_COLOR);
        else
            ctx.disableVertexAttribArray(cc.VERTEX_ATTRIB_COLOR);
        cc._vertexAttribColor = enableColor;
    }

    /* Tex Coords */
    var enableTexCoords = (flags & cc.VERTEX_ATTRIB_FLAG_TEX_COORDS);
    if (enableTexCoords !== cc._vertexAttribTexCoords) {
        if (enableTexCoords)
            ctx.enableVertexAttribArray(cc.VERTEX_ATTRIB_TEX_COORDS);
        else
            ctx.disableVertexAttribArray(cc.VERTEX_ATTRIB_TEX_COORDS);
        cc._vertexAttribTexCoords = enableTexCoords;
    }
};

/**
 * If the texture is not already bound, it binds it.<br/>
 * If CC_ENABLE_GL_STATE_CACHE is disabled, it will call glBindTexture() directly.
 * @function
 * @param {cc.Texture2D} textureId
 */
cc.glBindTexture2D = function (textureId) {
    cc.glBindTexture2DN(0, textureId);
};

/**
 * If the texture is not already bound to a given unit, it binds it.<br/>
 * If CC_ENABLE_GL_STATE_CACHE is disabled, it will call glBindTexture() directly.
 * @function
 * @param {Number} textureUnit
 * @param {cc.Texture2D} textureId
 */
cc.glBindTexture2DN = function (textureUnit, textureId) {
    if (cc._currentBoundTexture[textureUnit] === textureId)
        return;
    cc._currentBoundTexture[textureUnit] = textureId;

    var ctx = gl;
    cc.glActiveTexture(ctx.TEXTURE0 + textureUnit);
    if(textureId)
        ctx.bindTexture(ctx.TEXTURE_2D, textureId._webTextureObj);
    else
        ctx.bindTexture(ctx.TEXTURE_2D, null);
};
if (!cc.ENABLE_GL_STATE_CACHE){
    cc.glBindTexture2DN = function (textureUnit, textureId) {
        var ctx = gl;
        cc.glActiveTexture(ctx.TEXTURE0 + textureUnit);
        if(textureId)
            ctx.bindTexture(ctx.TEXTURE_2D, textureId._webTextureObj);
        else
            ctx.bindTexture(ctx.TEXTURE_2D, null);
    };
}

/**
 * It will delete a given texture. If the texture was bound, it will invalidate the cached. <br/>
 * If CC_ENABLE_GL_STATE_CACHE is disabled, it will call glDeleteTextures() directly.
 * @function
 * @param {WebGLTexture} textureId
 */
cc.glDeleteTexture = function (textureId) {
    cc.glDeleteTextureN(0, textureId);
};

/**
 * It will delete a given texture. If the texture was bound, it will invalidate the cached for the given texture unit.<br/>
 * If CC_ENABLE_GL_STATE_CACHE is disabled, it will call glDeleteTextures() directly.
 * @function
 * @param {Number} textureUnit
 * @param {WebGLTexture} textureId
 */
cc.glDeleteTextureN = function (textureUnit, textureId) {
    if (cc.ENABLE_GL_STATE_CACHE) {
        if (textureId === cc._currentBoundTexture[ textureUnit ])
            cc._currentBoundTexture[ textureUnit ] = -1;
    }
    gl.deleteTexture(textureId);
};

/**
 * If the vertex array is not already bound, it binds it.<br/>
 * If CC_ENABLE_GL_STATE_CACHE is disabled, it will call glBindVertexArray() directly.
 * @function
 * @param {Number} vaoId
 */
cc.glBindVAO = function (vaoId) {
    if (!cc.TEXTURE_ATLAS_USE_VAO)
        return;

    if (cc.ENABLE_GL_STATE_CACHE) {
        if (cc._uVAO !== vaoId) {
            cc._uVAO = vaoId;
            //TODO need fixed
            //glBindVertexArray(vaoId);
        }
    } else {
        //glBindVertexArray(vaoId);
    }
};

cc.boundArrayBuffer = null;
cc.glBindArrayBuffer = function(buffer)
{
    if (this.boundArrayBuffer !== buffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        this.boundArrayBuffer = buffer;
    }

    cc.boundVertexFormats = null; //we invalidate this here, the vertex format is assumed to change when renderCmds manually bind buffers
    cc._stateCacheStats.vertexFormatSwitches++;
}

cc.boundElementBuffer = null;
cc.glBindElementBuffer = function(buffer)
{
    if(this.boundElementBuffer !== buffer)
    {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
        this.boundElementBuffer = buffer;
    }
}

cc.boundVertexFormats = null; //this maps the indices to the vertex formats and their buffers

//binds a buffer to a set of vertex format descriptions (the ones used in vertexAttribPointer). vertexFormats is an array of objects. those objects contain a buffer and associated formats in the form: 
/*{
    buffer: buffer,
    formats: arrayOfFormats
}*/
//the objects inside THOSE arrays look like this (values are example based)
/*{
    location: 0,
    components: 2,
    type: gl.FLOAT,
    normalize: false,
    stride: 24,
    offset: 12
}*/

cc.glBindVertexFormat = function (vertexFormats)
{
    if(cc.boundVertexFormats !== vertexFormats)
    {
        for(var i=vertexFormats.length-1;i>=0;--i)
        {
            var buf = vertexFormats[i].buffer;
            var formats = vertexFormats[i].formats;
            cc.glBindArrayBuffer( buf);

            for (var j = 0; j < formats.length;++j)
            {
                var format = formats[j];
                gl.enableVertexAttribArray(format.location);
                gl.vertexAttribPointer(format.location, format.components, format.type, format.normalize, format.stride, format.offset);
            }
        }

        cc.boundVertexFormats = vertexFormats;
        cc._stateCacheStats.vertexFormatSwitches++;
    }
}

cc.glBuffers = [];
cc.glBufferIDs = [];
cc.glCurrentBufferID = 0;

cc.glCreateBuffer = function()
{
    var buf = gl.createBuffer();
    this.glBuffers.push(buf);
    var id = this.glCurrentBufferID;
    this.glBufferIDs.push(id);
    this.glCurrentBufferID++;

    return id;
}

cc.glDeleteBuffer = function (buffer)
{
    var idx = this.glBufferIDs.indexOf(buffer);
    if(idx >= 0)
    {
        this.glBufferIDs.removeByLastSwap(idx);
        this.glBuffers.removeByLastSwap(idx);
    }
}

var activeTextureSlot = -1;
cc.glActiveTexture =function(slot)
{
    if(activeTextureSlot !== slot)
    {
        activeTextureSlot = slot;
        gl.activeTexture(slot);
    }
}