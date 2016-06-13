/****************************************************************************
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

(function () {
    cc.BatchedLabel.WebGLRenderCmd = function (renderable) {
        cc.Node.WebGLRenderCmd.call(this, renderable);
        this._needDraw = true;
        this._quadBuffer = new QuadBuffer();
        this._shaderProgram = cc.shaderCache.programForKey(cc.SHADER_POSITION_TEXTURECOLOR);
    };

    var proto = cc.BatchedLabel.WebGLRenderCmd.prototype = Object.create(cc.Node.WebGLRenderCmd.prototype);
    proto.constructor = cc.BatchedLabel.WebGLRenderCmd;

    proto.setString = function(str)
    {
        this._quadBuffer.allocateForSize(str.length);
    }

    proto.rendering = function ()
    {
        var node = this._node;
        this._shaderProgram.use();
        this._shaderProgram._setUniformForMVPMatrixWithMat4(this._stackMatrix);

        //optimize performance for javascript
        cc.glBindTexture2DN(0, node._atlasTexture);                   // = cc.glBindTexture2D(locTexture);
        cc.glEnableVertexAttribs(cc.VERTEX_ATTRIB_FLAG_POS_COLOR_TEX);
        //cc.glBlendFunc(gl.REPLACE,gl.REPLACE);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._quadBuffer.getGLBuffer());

        var indices = this.getQuadIndexBuffer(node._string.length);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);                   //cc.VERTEX_ATTRIB_POSITION
        gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, 24, 12);           //cc.VERTEX_ATTRIB_COLOR
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 24, 16);                  //cc.VERTEX_ATTRIB_TEX_COORDS
        gl.drawElements(gl.TRIANGLES, 6 * node._string.length, gl.UNSIGNED_SHORT, 0);
    };

    proto.updateAtlasValues = function () {
        var node = this._node;
        var locString = node._string;
        var locTextureAtlas = node._atlasTexture;

        var texture = locTextureAtlas;
        var textureWide = texture.pixelsWidth;
        var textureHigh = texture.pixelsHeight;

        var quads = this._quadBuffer.getQuads();
        var locDisplayedColor = this._displayedColor;
        var curColor = { r: locDisplayedColor.r, g: locDisplayedColor.g, b: locDisplayedColor.b, a: node._displayedOpacity };

        var map = node._charMap;
        var x = 0;

        //first we have to split lines
        var lines = [];
        var lastLineBeginning = 0;
        for (var i = 0; i < locString.length; ++i) {
            var charCode = locString.charCodeAt(i);
            var char = locString[i];
            if (char === "\n") //just split to next line 
            {
                lines.push(locString.substr(lastLineBeginning, i - lastLineBeginning));
                i++;//skip over \n
                x = 0;
                lastLineBeginning = i;
            }
            else if (char === " ") //if there's a space we have to scan the next word to see if it goes 
            {
                //scan next word
                var begun = false;
                var nextX = x;
                for (var j = i + 1; j < n; ++j) //find next word 
                {
                    char = locString[j];
                    if (char !== " ") //check for starting space, here it begins
                    {
                        begun = true;

                        var entry = map[locString.charCodeAt(j)];
                        if (entry) //advance the x position with every char along the word
                        {
                            nextX += entry.xAdvance;
                        }
                    }
                    else if (char === " " && begun) //another space found, this is the end
                    {
                        break;
                    }
                }

                if (nextX > node._lineWidth) //bigger than max linewidth? break lines up on last word
                {
                    lines.push(locString.substr(lastLineBeginning, i - lastLineBeginning));
                    lastLineBeginning = i + 1;
                    x = 0;
                }
            }
            else {
                var entry = map[charCode];
                if (entry) {
                    x += entry.xAdvance;
                }
            }

        }

        if(lines.length===0)
            lines.push(locString);

        var invTexHeight = 1 / textureHigh;
        var invTexWidth = 1 / textureWide;
        var lineHeight = node._lineHeight;

        var currentChar = 0;
        for (var line = 0; line < lines.length; ++line) {
            var y = -lineHeight * line + lineHeight; //the +lineHeight is because we start with an offset of 1 line, so the first line isn't drawn 'below the screen' if you place the text at y =0
            var word = lines[line];
            x = 0;
            for (var i = 0; i < word.length; i++) {
                var a = word.charCodeAt(i);
                var mapEntry = map[a];
                var rect = mapEntry.rect; //NOTICE FOR DEBUGGERS: IF THIS LINE CRASHES, MOST LIKELY YOUR FONT IS MISSING SOME CHARACTERS YOU USED IN THE STRING

                var left, right, top, bottom;

                left = (rect.x) * invTexWidth;
                right = (rect.x + rect.width) * invTexWidth;
                top = (rect.y) * invTexHeight;
                bottom = (rect.y + rect.height) * invTexHeight;

                var quad = quads[currentChar];
                var locQuadTL = quad.tl, locQuadTR = quad.tr, locQuadBL = quad.bl, locQuadBR = quad.br;
                locQuadTL.texCoords.u = left;
                locQuadTL.texCoords.v = top;
                locQuadTR.texCoords.u = right;
                locQuadTR.texCoords.v = top;
                locQuadBL.texCoords.u = left;
                locQuadBL.texCoords.v = bottom;
                locQuadBR.texCoords.u = right;
                locQuadBR.texCoords.v = bottom;

                locQuadBL.vertices.x = x + mapEntry.xOffset + 0.5;
                locQuadBL.vertices.y = y - rect.height - mapEntry.yOffset + 0.5;
                locQuadBL.vertices.z = 0.0;
                locQuadBR.vertices.x = x + rect.width + mapEntry.xOffset + 0.5;
                locQuadBR.vertices.y = y - rect.height - mapEntry.yOffset + 0.5;
                locQuadBR.vertices.z = 0.0;
                locQuadTL.vertices.x = x + mapEntry.xOffset + 0.5;
                locQuadTL.vertices.y = y - mapEntry.yOffset + 0.5;
                locQuadTL.vertices.z = 0.0;
                locQuadTR.vertices.x = x + rect.width + mapEntry.xOffset + 0.5;
                locQuadTR.vertices.y = y - mapEntry.yOffset + 0.5;
                locQuadTR.vertices.z = 0.0;
                locQuadTL.colors = curColor;
                locQuadTR.colors = curColor;
                locQuadBL.colors = curColor;
                locQuadBR.colors = curColor;

                x += mapEntry.xAdvance;
                currentChar++;
            }
        }

        this._quadBuffer.updateGLBuffers();
        //this.updateContentSize(i, 1);
        /*if (n > 0) {
            locTextureAtlas.dirty = true;
            var totalQuads = locTextureAtlas.totalQuads;
            if (n > totalQuads)
                locTextureAtlas.increaseTotalQuadsWith(n - totalQuads);
        }*/
    };

    proto._addChild = function () { };
})();