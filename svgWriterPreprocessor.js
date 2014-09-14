// Copyright (c) 2014 Adobe Systems Incorporated. All rights reserved.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, bitwise: true */
/*global define: true, require: true, module: true */

/* Help construct the svgOM from generator data */

(function () {
"use strict";
    
    var SVGStylesheet = require("./svgStylesheet.js"),
        svgWriterStroke = require("./svgWriterStroke.js"),
        svgWriterFill = require("./svgWriterFill.js"),
        svgWriterFx = require("./svgWriterFx.js"),
        svgWriterUtils = require("./svgWriterUtils.js"),
        svgWriterText = require("./svgWriterText.js"),
        px = svgWriterUtils.px;
    
	function SVGWriterPreprocessor() {
        
        this.scanForUnsupportedFeatures = function (ctx) {
            svgWriterFill.scanForUnsupportedFeatures(ctx);
            svgWriterStroke.scanForUnsupportedFeatures(ctx);
            svgWriterFx.scanForUnsupportedFeatures(ctx);
            svgWriterText.scanForUnsupportedFeatures(ctx);
        };
        
        this.provideBackupDefaults = function (omIn, styleBlock) {
            if (omIn.style && styleBlock.hasRules()) {
                if (omIn.type === "shape" && omIn.style["fill"] === undefined) {
                    omIn.style["fill"] = "none";
                    styleBlock.addRule("fill", "none");
                }
            }
        }
        
        /**
         * Externalize styles identifies styles that can be detached from artwork.
         **/
        this.externalizeStyles = function (ctx) {
            var omIn = ctx.currentOMNode,
                property,
                styleBlock;

            ctx.stylesCurrentBlock = null;
            
            svgWriterFill.externalizeStyles(ctx);
            svgWriterStroke.externalizeStyles(ctx);
            svgWriterFx.externalizeStyles(ctx);

            styleBlock = ctx.omStylesheet.getStyleBlock(omIn);
            
            this.provideBackupDefaults(omIn, styleBlock);
            
            if (omIn.style) {
                Object.keys(omIn.style).forEach(function (property) {
                    if (omIn.style[property] === undefined) {
                        return;
                    }
                    // fill, stroke and fx are handled above.
                    if (property === "fill" || property === "stroke" | property ==="fx") {
                        return;
                    }
                    if (property === "font-size") {
                        styleBlock.addRule(property, px(ctx, omIn.style[property]) + "px");
                        return;
                    }
                    if (property.indexOf("_") !== 0) {
                        styleBlock.addRule(property, omIn.style[property]);
                    }
                });
            }
            
        };
        
        this.growBoundsUniform = function (bounds, delta) {
            bounds.left -= delta;
            bounds.right += delta;
            bounds.top -= delta;
            bounds.bottom += delta;
        };
        
        this.shiftBoundsX = function (bounds, delta) {
            bounds.left += delta;
            bounds.right += delta;
        };
        
        this.shiftBoundsY = function (bounds, delta) {
            bounds.top += delta;
            bounds.bottom += delta;
        };
        
        this.recordBounds = function (ctx, omIn) {
            var bnds = ctx.contentBounds,
                bndsIn = omIn.bounds,
                boundPadLeft = 0,
                boundPadRight = 0,
                boundPadTop = 0,
                boundPadBottom = 0,
                bndsTextFx,
                bndsText;

            // FIXME: We need to optimize layer size in general. FX might have the boundaries
            if (omIn.boundsWithFX) {
                bndsIn = omIn.boundsWithFX;
                /*
                if (omIn.type !== "text") {
                    bndsIn = omIn.boundsWithFX;
                } else {
                    bndsTextFx = omIn.boundsWithFX;
                    if (omIn.textBounds) {
                        bndsText = omIn.textBounds;
                    } else if (omIn.shapeBounds) {
                        bndsText = omIn.shapeBounds;
                    } else {
                        bndsText = omIn.boundsWithFX;
                    }
                    
                    bndsText = omIn.textBounds ? omIn.textBounds : omIn.shapeBounds;
                    bndsIn = {
                        top: Math.min(bndsTextFx.top, bndsText.top),
                        bottom: Math.max(bndsTextFx.bottom, bndsText.bottom),
                        left: Math.min(bndsTextFx.left, bndsText.left),
                        right: Math.max(bndsTextFx.right, bndsText.right)
                    };
                }
                */
            } else {
                if (omIn.type === "shape" || omIn.type === "group" || (omIn.type === "generic" && omIn.shapeBounds)) {
                    bndsIn = omIn.shapeBounds;
                } else if (omIn.type === "text") {
                    if (omIn.textBounds) {
                        bndsIn = omIn.textBounds;
                    } else {
                        bndsIn = omIn.shapeBounds;
                    }
                }
            }
            
            if (omIn.style && omIn.style.stroke && omIn.style.stroke.strokeEnabled && omIn.style.stroke.lineWidth) {
                //the shape has a border then we need to bump the bounds up?
                boundPadLeft = omIn.style.stroke.lineWidth/2.0;
                boundPadRight = omIn.style.stroke.lineWidth/2.0;
                boundPadTop = omIn.style.stroke.lineWidth/2.0;
                boundPadBottom = omIn.style.stroke.lineWidth/2.0;
            }
            
            if (omIn.type === "shape" && (omIn.shape === "circle" || omIn.shape === "ellipse")) {
                if ((bndsIn.right - bndsIn.left) % 2 !== 0) {
                    boundPadRight += 1.0;
                }
                if ((bndsIn.bottom - bndsIn.top) % 2 !== 0) {
                    boundPadBottom += 1.0;
                }
            }

            if (bndsIn) {
                if (!isFinite(bnds.left) || (bndsIn.left - boundPadLeft) < bnds.left) {
                    bnds.left = (bndsIn.left - boundPadLeft);
                }
                if (!isFinite(bnds.right) || (bndsIn.right + boundPadRight) > bnds.right) {
                    bnds.right = bndsIn.right + boundPadRight;
                }
                if (!isFinite(bnds.top) || (bndsIn.top - boundPadTop) < bnds.top) {
                    bnds.top = bndsIn.top - boundPadTop;
                }
                if (!isFinite(bnds.bottom) || (bndsIn.bottom + boundPadBottom) > bnds.bottom) {
                    bnds.bottom = bndsIn.bottom + boundPadBottom;
                }
            }
        };
        
        //shift the bounds recorded in recordBounds
        this.shiftBounds = function (ctx, omIn, nested, sibling) {
            var bnds = omIn.bounds,
                pR,
                pL,
                newMid,
                deltaX,
                deltaX2,
                deltaY,
                deltaY2;
            if (omIn.type === "shape" || omIn.type === "text" ||
                omIn.type === "group" || (omIn.type === "generic" && omIn.shapeBounds)) {
                bnds = omIn.shapeBounds;
                if (omIn.type === "text") {
                    if (omIn.transform) {
                        omIn.transform.translate(ctx._shiftContentX, ctx._shiftContentY);
                    }
                    if (omIn.position) {
                        if (!nested) {
                            omIn.position.x = 0.0;
                            omIn.position.y = 1.0;
                            omIn.position.unitEM = true;
                            if (omIn.children && omIn.children.length === 1) {
                                omIn.children[0].position = omIn.children[0].position || {x: 0, y: 0};
                                omIn.children[0].position.x = 0.0;
                            }
                        } else if (omIn.position.unitPX) {
                            omIn.position.x += ctx._shiftContentX;
                            omIn.position.y += ctx._shiftContentY;
                        }
                    }
                } else if (omIn.type === "shape") {
                    if (omIn.shape === "circle" || omIn.shape === "ellipse") {
                        if ((bnds.right - bnds.left) % 2 !== 0) {
                            bnds.right += 1.0;
                        }
                        if ((bnds.bottom - bnds.top) % 2 !== 0) {
                            bnds.bottom += 1.0;
                        }
                    }
                    if (omIn.shape === "circle" || omIn.shape === "ellipse" || omIn.shape === "rect") {
                        if (omIn.boundsWithFX) {
                            deltaX = (omIn.boundsWithFX.right - omIn.shapeBounds.right);
                            deltaX2 = (omIn.shapeBounds.left - omIn.boundsWithFX.left);
                            deltaY = -(omIn.boundsWithFX.top - omIn.shapeBounds.top);
                            deltaY2 = omIn.boundsWithFX.bottom - omIn.shapeBounds.bottom;
                            
                            deltaX = -(deltaX + deltaX2) / 2.0;
                            deltaY = -(deltaY + deltaY2) / 2.0;
                            
                            this.shiftBoundsX(bnds, deltaX);
                            this.shiftBoundsY(bnds, deltaY);
                        }
                    }
                }
                
            } else if (omIn.type === "tspan") {
                if (omIn.style) {
                    if (isFinite(omIn.position.x)) {
                        if (omIn.style["text-anchor"] === "middle") {
                            if(omIn._parentBounds) {
                                pR = omIn._parentBounds.right;
                                pL = omIn._parentBounds.left;
                                newMid = omIn._parentBounds.left + (pR - pL) / 2.0;
                                if (omIn._parentIsRoot) {
                                    omIn.position.x = 50;
                                } else {
                                    omIn.position.x = newMid;
                                    omIn.position.unitXPX = true;
                                }
                            } else {
                                omIn.position.x = 50;
                            }
                            
                        } else if (omIn.style["text-anchor"] === "end") {
                            
                            pR = omIn._parentBounds.right;
                            pL = omIn._parentBounds.left;
                            newMid = omIn._parentBounds.left + (pR - pL) / 2.0;
                            
                            if (omIn._parentIsRoot || !omIn.textBounds) {
                                omIn.position.x = 100;
                            } else {
                                deltaX = (ctx.contentBounds.right - omIn.textBounds.right);
                                omIn.position.deltaX = -deltaX;
                            }
                        } else {
                            if (sibling) {
                                omIn.position.x += ctx._shiftContentX;
                            } else {
                                if (omIn._parentIsRoot) {
                                    omIn.position.x = 0;
                                } else {
                                    omIn.position.x = undefined;
                                }
                            }
                        }
                    }
                    
                    if (omIn.style["_baseline-script"] === "sub" ||
                        omIn.style["_baseline-script"] === "super") {
                        if (typeof omIn.style["font-size"] === "number") {
                            omIn.style["font-size"] = Math.round(omIn.style["font-size"] / 2.0);
                        } else {
                            omIn.style["font-size"].value = Math.round(omIn.style["font-size"].value / 2.0);
                        }
                    }
                    
                    if (omIn.style["_baseline-script"] === "super") {
                        omIn.position = omIn.position || {};
                        omIn.position.y = -0.5;
                        omIn.position.unitEM = true;
                    }
                }
            }
                
            if (bnds) {
                this.shiftBoundsX(bnds, ctx._shiftContentX);
                this.shiftBoundsY(bnds, ctx._shiftContentY);
            }
        };
        
        this.preprocessSVGNode = function (ctx) {
            var omIn = ctx.currentOMNode,
                children = omIn.children;
            
            if (ctx.config.trimToArtBounds) {
                this.recordBounds(ctx, omIn);
            }
            
            if (children) {
                children.forEach(function (childNode) {
                    ctx.currentOMNode = childNode;
                    this.preprocessSVGNode(ctx);
                }.bind(this));
            }
        };
        
        this.finalizePreprocessing = function (ctx) {
            var bnds = ctx.contentBounds,
                adjustBounds = 1;
            if (ctx.config.trimToArtBounds) {
                
                if (bnds) {                    
                    bnds.left = svgWriterUtils.roundDown(bnds.left || 0);
                    bnds.right = svgWriterUtils.roundUp(bnds.right || 0);
                    bnds.top = svgWriterUtils.roundDown(bnds.top || 0);
                    bnds.bottom = svgWriterUtils.roundUp(bnds.bottom || 0);

                    ctx._shiftContentX = -bnds.left;
                    ctx._shiftContentY = -bnds.top;
                    
                    if (ctx.svgOM && ctx.svgOM.viewBox) {
                        ctx.svgOM.viewBox.left = 0;
                        ctx.svgOM.viewBox.top = 0;
                        ctx.svgOM.viewBox.right = bnds.right - bnds.left;
                        ctx.svgOM.viewBox.bottom = bnds.bottom - bnds.top;
                    }
                }
            }
        };
        
        this.processSVGNode = function (ctx, nested, sibling) {
            var omIn = ctx.currentOMNode,
                children = omIn.children;
            
            //if these bounds shifted is not 0 then shift children to be relative to this text block...
            if (omIn.type === "text" && omIn.children) {
                omIn.children.forEach(function (chld) {
                    chld._parentBounds = omIn.shapeBounds;
                    chld._parentIsRoot = !nested;
                });
            }
            
            if (ctx.config.trimToArtBounds && omIn !== ctx.svgOM) {   
                this.shiftBounds(ctx, omIn, nested, sibling);
            }
            
            this.scanForUnsupportedFeatures(ctx);
            
            this.externalizeStyles(ctx);
            
            if (omIn.type == "textPath") {
                svgWriterUtils.writeTextPath(ctx, omIn.pathData);
            }
            
            if (children) {
                children.forEach(function (childNode, ind) {
                    ctx.currentOMNode = childNode;
                    this.processSVGNode(ctx, (omIn !== ctx.svgOM), (ind !== 0));
                }.bind(this));
            }
        };
        
        this.preprocessingNecessary = function (ctx) {
            //more reasons to be added as necessary
            if (ctx.config.trimToArtBounds) {
                return true;
            }
            return false;
        };
        
        this.processSVGOM = function (ctx) {
            var omSave = ctx.currentOMNode;
            ctx.omStylesheet = new SVGStylesheet();
            
            if (this.preprocessingNecessary(ctx)) {
                this.preprocessSVGNode(ctx, ctx.currentOMNode);
                this.finalizePreprocessing(ctx);
                ctx.currentOMNode = omSave;
            }
            this.processSVGNode(ctx, false, false);
            ctx.currentOMNode = omSave;
        };
        
	}

	module.exports = new SVGWriterPreprocessor();
    
}());
     
    