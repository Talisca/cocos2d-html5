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
    ctor: function (strText, _charMapFile, lineWidth) {
        cc.Node.prototype.ctor.call(this);
        this._lineWidth = lineWidth || Number.MAX_VALUE;
        this._displayedColor = new cc.Color(255, 255, 255, 255);
        this.setAnchorPoint(0.5,0.5);
        this.setHorizontalAlignment(cc.TEXT_ALIGNMENT_LEFT);

        var dict = cc.loader.getRes(_charMapFile || cc.BatchedLabel.prototype._defaultCharMapFile);

        if (!dict) {
            return false;
        }

        var textureFilename = dict.atlasName;
        this._charMap = dict.fontDefDictionary;
        this._lineHeight = dict.commonHeight;

        var texture = null;
        texture = this._atlasTexture = cc.textureCache.addImage(textureFilename);
        this.setString(strText || "");
    },

    setPosition: function(x,y)
    {
        //we force stuff to be placed into the middle of a pixel
        var _x,_y;
        if(y === undefined)
        {
            _x = Math.floor(x.x ) +0.5;
            _y = Math.floor(x.y ) + 0.5;
        }
        else
        {
            _x = Math.floor(x ) + 0.5;
            _y = Math.floor(y ) + 0.5;
        }

        cc.Node.prototype.setPosition.call(this,_x,_y);
    },
    //sets maximum line width before line break happens (default is 'infinity')
    setMaxLineWidth: function(width)
    {
        this._lineWidth = width;
        this._renderCmd.updateAtlasValues();
    },
    setHorizontalAlignment: function(align)
    {
        this._horizontalAlignment = align;  
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
