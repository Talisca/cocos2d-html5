//label class based on usual bitmap fonts that supports batched rendering
cc.BatchedLabel = cc.Node.extend(/** @lends cc.LabelAtlas# */{
    //property String is Getter and Setter
    // string to render
    _string: null,

    /**
     * <p>
     *  Constructor function, override it to extend the construction behavior, remember to call "this._super()" in the extended "ctor" function. <br />
     *  Create a label atlas. <br />
     *  It accepts two groups of parameters: <br/>
     * a) string, fntFile <br/>
     * b) label, textureFilename, width, height, startChar <br/>
     * </p>
     * @param {String} strText
     * @param {String} charMapFile  charMapFile or fntFile
     * @param {Number} [lineWidth=Number.MAX_VALUE], maximum line width of a single line of text
     */
    ctor: function (strText, _charMapFile, lineWidth, fontSize) {
        cc.Node.prototype.ctor.call(this);
        this._stringDirty = false;
        this._lineWidth = lineWidth || Number.MAX_VALUE;
        this._maxHeight = Number.MAX_VALUE;
        this._displayedColor = new cc.Color(255, 255, 255, 255);

        this.setAnchorPoint(0.5,0.5);
        this.setHorizontalAlignment(cc.TEXT_ALIGNMENT_LEFT);
        

        var dict = cc.loader.getRes(_charMapFile || cc.BatchedLabel.prototype._defaultCharMapFile);

        if (!dict) {
            return false;
        }

        var textureFilename = dict.atlasName;
        this._charMap = dict.fontDefDictionary;
        this._lineHeight = this._originalLineHeight = dict.commonHeight;
        this._fontSize = fontSize || this._lineHeight;
        this._fontSizeFactor = this._fontSize / this._originalLineHeight;
        var texture = null;
        texture = this._atlasTexture = cc.textureCache.addImage(textureFilename);
        this.setString(strText || "");
    },
    setFontSize: function(size)
    {
        this._fontSize = size;
        this._lineHeight = size;
        this._fontSizeFactor = this._fontSize / this._originalLineHeight;
        this._stringDirty = true;
    },
    getFontSize: function()
    {
        return this._fontSize;
    },
    //sets maximum line width before line break happens (default is 'infinity')
    setMaxLineWidth: function(width)
    {
        this._lineWidth = width;
        this._stringDirty = true;
    },
    //sets maximum height of the text. when multiple lines would be drawn otherwise, everything after the maximum will simply be cut off
    setMaxHeight: function(height)
    {
        this._maxHeight = height;
        this._stringDirty = true;
    },
    setHorizontalAlignment: function(align)
    {
        this._horizontalAlignment = align;
        this._stringDirty = true; 
    },
    setVerticalAlignment: function(align)
    {
        this._verticalAlignment = align;
        this._stringDirty = true;
    },
    getMaxLineWidth: function()
    {
        return this._lineWidth;
    },
    _createRenderCmd: function () {
        return new cc.BatchedLabel.WebGLRenderCmd(this);
    },
    setTextColor: function(col)
    {
        this._displayedColor = col;
        this._stringDirty = true;
    },
    /**
     * return the text of this label
     * @return {String}
     */
    getString: function () {
        return this._string;
    },
    getContentSize: function()
    {
        return this._renderCmd.getContentSize();
    },
    setString: function (label) {
        if (this._string === label)
            return;
        this._string = String(label);
        this._renderCmd.setString(this._string);
        this._renderCmd.updateAtlasValues();

        //update content size
        //this.setContentSize();
    }
});
