﻿var express = require("express"),
    fs = require("fs"),
    path = require("path"),
    constants = require("./constants.js"),
    middleware = require("./middleware.js"),
    formatting = require("./formatting.js");

var config, database, sitePages;

var restrictedRoute = middleware.restrictedRoute;
var urlencodedParser = middleware.bodyParser;
var server = express.Router();

server.get("/sa/mirrors", restrictedRoute("sa"), function (req, res) {
    database.execute("SELECT * FROM DownloadMirrors", [], function (mrErr, mrRes, mrFields) {
        return res.render("saMirrors", {
            sitePages: sitePages,
            user: req.user,

            mirrors: mrRes.map(function (x) {
                x.MirrorUUID = formatting.binToHex(x.MirrorUUID);
                return x;
            })
        });
    });
});

server.get("/sa/mirror/:mirror", restrictedRoute("sa"), function (req, res) {
    database.execute("SELECT * FROM `DownloadMirrors` WHERE `MirrorUUID` = ?", [formatting.hexToBin(req.params.mirror)], function (mrErr, mrRes, mrFields) {
        var mirror = mrRes[0] || null;
        if (mrErr || mirror == null) {
            res.status(404).render("error", {
                sitePages: sitePages,
                user: req.user,

                message: "There is no mirror."
            });
        }
        mirror.ProductUUID = formatting.binToHex(mirror.ProductUUID);
        return res.render("saMirror", {
            sitePages: sitePages,
            user: req.user,

            mirror: mirror,
        });
    });
});

server.post("/sa/editMirrorMetadata/:mirror", restrictedRoute("sa"), urlencodedParser, function (req, res) {
    if (req.body && req.params.mirror && formatting.isHexString(req.params.mirror)) {
        var uuid = req.params.mirror;
        var dbParams = [req.body.name, req.body.hostname, formatting.hexToBin(uuid)];
        database.execute("UPDATE DownloadMirrors SET MirrorName = ?, Hostname = ? WHERE ProductUUID = ?", dbParams, function (prErr, prRes, prFields) {
            if (prErr) {
                return res.status(500).render("error", {
                    sitePages: sitePages,
                    user: req.user,

                    message: "The mirror could not be edited."
                });
            } else {
                return res.redirect("/sa/mirror/" + req.params.mirror);
            }
        });
    } else {
        return res.status(404).render("error", {
            sitePages: sitePages,
            user: req.user,

            message: "The request was malformed."
        });
    }
});

server.get("/sa/createMirror", restrictedRoute("sa"), function (req, res) {
    return res.render("saCreateMirror", {
        sitePages: sitePages,
        user: req.user,
    });
});

server.post("/sa/createMirror", restrictedRoute("sa"), urlencodedParser, function (req, res) {
    const getNewMirrorQuery = "SELECT * FROM `DownloadMirrors` WHERE `MirrorName` = ? && `Hostname` = ?";

    if (req.body && req.body.hostname && req.body.name) {
        // check for dupe
        var hostname = req.body.hostname;
        var name = req.body.name;
        var dbParams = [name, hostname];
        database.execute(getNewMirrorQuery, dbParams, function (dbErr, dbRes, dbFields) {
            if (dbErr || dbRes == null) {
                return res.status(500).render("error", {
                    sitePages: sitePages,
                    user: req.user,

                    message: "There was an error checking the database."
                });
            } else if (dbRes.length > 0) {
                return res.status(409).render("error", {
                    sitePages: sitePages,
                    user: req.user,

                    message: "There is already a mirror with that name or hostname."
                });
            } else {
                database.execute("INSERT INTO DownloadMirrors (MirrorName, Hostname) VALUES (?, ?)", dbParams, function (inErr, inRes, inFields) {
                    if (inErr) {
                        return res.status(500).render("error", {
                            sitePages: sitePages,
                            user: req.user,

                            message: "There was an error creating the item."
                        });
                    } else {
                        database.execute(getNewMirrorQuery, dbParams, function (mrErr, mrRes, mrFields) {
                            if (mrErr || mrRes == null || mrRes.length == 0) {
                                return res.status(500).render("error", {
                                    sitePages: sitePages,
                                    user: req.user,

                                    message: "There was an error validating the item."
                                });
                            } else {
                                return res.redirect("/sa/mirror/" + mrRes[0].Slug);
                            }
                        });
                    }
                });
            }
        });
    } else {
        return res.status(400).render("error", {
            sitePages: sitePages,
            user: req.user,

            message: "The request was malformed."
        });
    }
});

module.exports = function (c, d, p) {
    config = c
    database = d;
    sitePages = p;

    return server;
}