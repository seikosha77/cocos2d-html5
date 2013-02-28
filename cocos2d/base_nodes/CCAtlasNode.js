/****************************************************************************
 Copyright (c) 2010-2012 cocos2d-x.org
 Copyright (c) 2008-2010 Ricardo Quesada
 Copyright (c) 2011      Zynga Inc.

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


/** <p> cc.AtlasNode is a subclass of cc.Node that implements the cc.RGBAProtocol and<br/>
 * cc.TextureProtocol protocol</p>
 *
 * <p> It knows how to render a TextureAtlas object.  <br/>
 * If you are going to render a TextureAtlas consider subclassing cc.AtlasNode (or a subclass of cc.AtlasNode)</p>
 *
 * <p> All features from cc.Node are valid, plus the following features:  <br/>
 * - opacity and RGB colors </p>
 * @class
 * @extends cc.Node
 */
cc.AtlasNode = cc.Node.extend(/** @lends cc.AtlasNode# */{
    RGBAProtocol:true,
    //! chars per row
    _itemsPerRow:0,
    //! chars per column
    _itemsPerColumn:0,
    //! width of each char
    _itemWidth:0,
    //! height of each char
    _itemHeight:0,

    _colorUnmodified:null,
    _textureAtlas:null,

    // protocol variables
    _isOpacityModifyRGB:false,
    _blendFunc:null,

    _opacity:0,
    _color:null,
    _colorF32Array:null,

    // quads to draw
    _quadsToDraw:0,
    _uniformColor:null,

    _originalTexture:null,

    ctor:function () {
        this._super();
        this._colorUnmodified = cc.WHITE;
        this._color = cc.white();
        this._blendFunc = {src:cc.BLEND_SRC, dst:cc.BLEND_DST};
        this._opacity = 255;
    },

    /** initializes an cc.AtlasNode  with an Atlas file the width and height of each item and the quantity of items to render
     * @param {String} tile
     * @param {Number} tileWidth
     * @param {Number} tileHeight
     * @param {Number} itemsToRender
     * @return {Boolean}
     */
    initWithTileFile:function (tile, tileWidth, tileHeight, itemsToRender) {
        cc.Assert(tile != null, "title should not be null");
        this._itemWidth = tileWidth;
        this._itemHeight = tileHeight;

        this._isOpacityModifyRGB = true;

        if(cc.renderContextType === cc.WEBGL){
            this._colorF32Array = new Float32Array([this._color.r / 255.0, this._color.g / 255.0, this._color.b / 255.0, this._opacity / 255.0]);
            var newAtlas = new cc.TextureAtlas();
            newAtlas.initWithFile(tile, itemsToRender);
            this.setTextureAtlas(newAtlas);
            if (!this._textureAtlas) {
                cc.log("cocos2d: Could not initialize cc.AtlasNode. Invalid Texture.");
                return false;
            }
        }

        if (cc.renderContextType === cc.CANVAS){
            this._originalTexture = cc.TextureCache.getInstance().addImage(tile);
            if (!this._originalTexture) {
                cc.log("cocos2d: Could not initialize cc.AtlasNode. Invalid Texture.");
                return false;
            }
            this._textureForCanvas = this._originalTexture;
        }

        this._updateBlendFunc();
        this._updateOpacityModifyRGB();
        this._calculateMaxItems();

        this._quadsToDraw = itemsToRender;

        //shader stuff
        if (cc.renderContextType === cc.WEBGL) {
            this.setShaderProgram(cc.ShaderCache.getInstance().programForKey(cc.SHADER_POSITION_TEXTURE_UCOLOR));
            this._uniformColor = cc.renderContext.getUniformLocation(this.getShaderProgram().getProgram(), "u_color");
        }
        return true;
    },

    /** updates the Atlas (indexed vertex array).
     * Shall be overridden in subclasses
     */
    updateAtlasValues:function () {
        cc.Assert(false, "cc.AtlasNode:Abstract updateAtlasValue not overridden");
    },

    /**
     * @param {CanvasContext|WebGLRenderingContext} ctx CanvasContext
     */
    draw:function (ctx) {
        if (cc.renderContextType === cc.WEBGL) {
            var context = ctx || cc.renderContext;
            cc.NODE_DRAW_SETUP(this);
            cc.glBlendFunc(this._blendFunc.src, this._blendFunc.dst);
            context.uniform4fv(this._uniformColor, this._colorF32Array);

            this._textureAtlas.drawNumberOfQuads(this._quadsToDraw, 0);
        }
    },

    /** cc.AtlasNode - RGBA protocol
     * @return {cc.Color3B}
     */
    getColor:function () {
        if (this._isOpacityModifyRGB)
            return this._colorUnmodified;

        return this._color;
    },

    /**
     * @param {cc.Color3B} color3
     */
    setColor:function (color3) {
        if ((this._color.r == color3.r) && (this._color.g == color3.g) && (this._color.b == color3.b))
            return;
        this._color = this._colorUnmodified = color3;

        if (cc.renderContextType === cc.CANVAS) {
            if (this.getTexture()) {
                var cacheTextureForColor = cc.TextureCache.getInstance().getTextureColors(this._originalTexture);
                if (cacheTextureForColor) {
                    var tx = this._originalTexture;
                    var textureRect = cc.rect(0, 0, tx.width, tx.height);
                    var colorTexture = cc.generateTintImage(tx, cacheTextureForColor, this._color, textureRect);
                    //TODO need test for modify
/*                    var img = new Image();
                    img.src = colorTexture.toDataURL();*/
                    this.setTexture(colorTexture);
                }
            }
        }

        if (this._isOpacityModifyRGB) {
            this._color.r = color3.r * this._opacity / 255;
            this._color.g = color3.g * this._opacity / 255;
            this._color.b = color3.b * this._opacity / 255;
        }

        if (cc.renderContextType === cc.WEBGL)
            this._colorF32Array = new Float32Array([this._color.r / 255.0, this._color.g / 255.0, this._color.b / 255.0, this._opacity / 255.0]);
    },

    /**
     * @return {Number}
     */
    getOpacity:function () {
        return this._opacity;
    },

    /**
     * @param {Number} opacity
     */
    setOpacity:function (opacity) {
        this._opacity = opacity;
        // special opacity for premultiplied textures
        if (this._isOpacityModifyRGB) {
            this.setColor(this._colorUnmodified);
        } else {
            if (cc.renderContextType === cc.WEBGL)
                this._colorF32Array = new Float32Array([this._color.r / 255.0, this._color.g / 255.0, this._color.b / 255.0, this._opacity / 255.0]);
        }
    },

    /**
     * @param {Boolean} value
     */
    setOpacityModifyRGB:function (value) {
        var oldColor = this.getColor();
        this._isOpacityModifyRGB = value;
        this.setColor(oldColor);
    },

    /**
     * @return {Boolean}
     */
    isOpacityModifyRGB:function () {
        return this._isOpacityModifyRGB;
    },

    /** cc.AtlasNode - CocosNodeTexture protocol
     * @return {cc.BlendFunc}
     */
    getBlendFunc:function () {
        return this._blendFunc;
    },

    /**
     * BlendFunc setter
     * @param {Number | cc.BlendFunc} src
     * @param {Number} dst
     */
    setBlendFunc:function (src, dst) {
        if (arguments.length == 1)
            this._blendFunc = src;
        else
            this._blendFunc = {src:src, dst:dst};
    },

    // cc.Texture protocol
    _textureForCanvas:null,
    /**
     * returns the used texture
     * @return {cc.Texture2D}
     */
    getTexture:function () {
        return  (cc.renderContextType === cc.CANVAS)?this._textureForCanvas : this._textureAtlas.getTexture();
    },

    /** sets a new texture. it will be retained
     * @param {cc.Texture2D} texture
     */
    setTexture:function (texture) {
        if(cc.renderContextType === cc.CANVAS)
            this._textureForCanvas = texture;
        else
            this._textureAtlas.setTexture(texture);
        this._updateBlendFunc();
        this._updateOpacityModifyRGB();
    },

    /**
     * @param {cc.TextureAtlas} value
     */
    setTextureAtlas:function (value) {
        this._textureAtlas = value;
    },

    /**
     * @return {cc.TextureAtlas}
     */
    getTextureAtlas:function () {
        return this._textureAtlas;
    },

    /**
     * @return {Number}
     */
    getQuadsToDraw:function () {
        return this._quadsToDraw;
    },

    /**
     * @param {Number} quadsToDraw
     */
    setQuadsToDraw:function (quadsToDraw) {
        this._quadsToDraw = quadsToDraw;
    },

    _calculateMaxItems:function () {
        var size;
        var selTexture = this.getTexture();
        if (selTexture instanceof cc.Texture2D)
            size = selTexture.getContentSize();
        else
            size = cc.size(selTexture.width, selTexture.height);

        this._itemsPerColumn = 0 | (size.height / this._itemHeight);
        this._itemsPerRow = 0 | (size.width / this._itemWidth);
    },

    _updateBlendFunc:function () {
        if (cc.renderContextType === cc.CANVAS)
            return;

        if (!this._textureAtlas.getTexture().hasPremultipliedAlpha()) {
            this._blendFunc.src = gl.SRC_ALPHA;
            this._blendFunc.dst = gl.ONE_MINUS_SRC_ALPHA;
        }
    },

    _updateOpacityModifyRGB:function () {
        if (cc.renderContextType === cc.WEBGL)
            this._isOpacityModifyRGB = this._textureAtlas.getTexture().hasPremultipliedAlpha();
    }

});

/** creates a cc.AtlasNode  with an Atlas file the width and height of each item and the quantity of items to render
 * @param {String} tile
 * @param {Number} tileWidth
 * @param {Number} tileHeight
 * @param {Number} itemsToRender
 * @return {cc.AtlasNode}
 * @example
 * // example
 * var node = cc.AtlasNode.create("pathOfTile", 16, 16, 1);
 */
cc.AtlasNode.create = function (tile, tileWidth, tileHeight, itemsToRender) {
    var ret = new cc.AtlasNode();
    if (ret.initWithTileFile(tile, tileWidth, tileHeight, itemsToRender))
        return ret;
    return null;
};
