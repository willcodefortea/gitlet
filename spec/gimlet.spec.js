var fs = require('fs');
var pathLib = require('path');
var g = require('../gimlet-api');

var expectFile = function(path, content) {
  expect(fs.readFileSync(path, "utf8")).toEqual(content);
};

describe('gimlet', function() {
  beforeEach(function() {
    var tmpDir = __dirname + "/tmp";
    if (fs.existsSync(tmpDir)) {
      rmdirSyncRecursive(tmpDir);
    }

    fs.mkdirSync(tmpDir);
    process.chdir(tmpDir); // switch working dir to test repo root

    expect(fs.readdirSync(process.cwd()).length).toEqual(0);
  });

  describe('init', function() {
    var expectGimletFilesAndDirectories = function() {
      expect(fs.existsSync(__dirname + "/tmp/.gimlet/hooks/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/tmp/.gimlet/info/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/tmp/.gimlet/logs/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/tmp/.gimlet/objects/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/tmp/.gimlet/refs/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/tmp/.gimlet/refs/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/tmp/.gimlet/refs/heads/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/tmp/.gimlet/refs/remotes/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/tmp/.gimlet/refs/remotes/origin/")).toEqual(true);
      expect(fs.existsSync(__dirname + "/tmp/.gimlet/refs/tags/")).toEqual(true);

      expect(fs.readFileSync(__dirname + "/tmp/.gimlet/HEAD", "utf8"))
        .toEqual("ref: refs/heads/master\n");
    };

    it('should create .gimlet/ and all required dirs', function() {
      g.init();
      expectGimletFilesAndDirectories();
    });

    it('should not change anything if init run twice', function() {
      g.init();
      g.init();
      expectGimletFilesAndDirectories();
    });
  });

  describe('hash-object', function() {
    it('should throw if not in repo', function() {
      expect(function() { g.hash_object(); })
        .toThrow("fatal: Not a gimlet repository (or any of the parent directories): .gimlet");
    });

    it('should return undefined if no file specified', function() {
      g.init();
      expect(g.hash_object()).toBeUndefined();
    });

    it('should throw if file specified does not exist', function() {
      g.init();
      expect(function() { g.hash_object("not-there") })
        .toThrow("fatal: Cannot open 'not-there': No such file or directory");
    });

    it('should return unique (!) hash of contents when file passed with no -w', function() {
      g.init();

      fs.writeFileSync("a.txt", "taoehusnaot uhrs.ochurcaoh. usrcao.h usrc oa.husrc aosr.ot");
      expect(g.hash_object("a.txt")).toEqual("19d6");

      fs.writeFileSync("b.txt", "oetuhntoaehuntao hesuh sano.tuh snato.h usntaho .u");
      expect(g.hash_object("b.txt")).toEqual("1700");
    });

    it('should store blob and return hash when file passed with -w', function() {
      var content = "taoehusnaot uhrs.ochurcaoh. usrcao.h usrc oa.husrc aosr.ot";
      g.init();
      fs.writeFileSync("a.txt", content);
      expect(g.hash_object("a.txt", { w:true })).toEqual("19d6");
      expect(fs.readFileSync(__dirname + "/tmp/.gimlet/objects/19d6", "utf8")).toEqual(content);
    });

    it('should not store blob when -w not passed', function() {
      var content = "taoehusnaot uhrs.ochurcaoh. usrcao.h usrc oa.husrc aosr.ot";
      g.init();
      fs.writeFileSync("a.txt", content);

      var objectPath = __dirname + "/tmp/.gimlet/objects/" + g.hash_object("a.txt");
      expect(fs.existsSync(objectPath, "utf8")).toEqual(false);

      // check that file is stored with -w
      g.hash_object("a.txt", { w: true });
      expect(fs.existsSync(objectPath, "utf8")).toEqual(true);
    });
  });

  describe('add', function() {
    it('should throw if not in repo', function() {
      expect(function() { g.add(); })
        .toThrow("fatal: Not a gimlet repository (or any of the parent directories): .gimlet");
    });

    it('should throw if no pathspec passed', function() {
      g.init();
      expect(function() { g.add(); }).toThrow("Nothing specified, nothing added.");
    });

    describe('pathspec matching', function() {
      it('should throw rel path if in root and pathspec does not match files', function() {
        g.init();
        expect(function() {
          g.add("blah");
        }).toThrow("fatal: pathspec 'blah' did not match any files");
      });

      it('should throw rel path if not in root and pathspec does not match files', function() {
        g.init();
        createFilesFromTree({ "1": { "2": {}}})
        process.chdir("1/2");
        expect(function() {
          g.add("blah");
        }).toThrow("fatal: pathspec '1/2/blah' did not match any files");
      });
    });

    describe('adding files', function() {
      it('should add all files in a large dir tree', function() {
        g.init();
        createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb", "2":
                                { "filec": "filec", "3":
                                  { "filed": "filed", "filee": "filee"}}}});
        g.add("1");
        expect(g.ls_files()[0]).toEqual("1/2/3/filed");
        expect(g.ls_files()[1]).toEqual("1/2/3/filee");
        expect(g.ls_files()[2]).toEqual("1/2/filec");
        expect(g.ls_files()[3]).toEqual("1/filea");
        expect(g.ls_files()[4]).toEqual("1/fileb");
        expect(g.ls_files().length).toEqual(5);
      });

      it('should add only files in specified subdir', function() {
        g.init();
        createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb", "2":
                                { "filec": "filec", "3":
                                  { "filed": "filed", "filee": "filee"}}}});
        g.add("1/2");
        expect(g.ls_files()[0]).toEqual("1/2/3/filed");
        expect(g.ls_files()[1]).toEqual("1/2/3/filee");
        expect(g.ls_files()[2]).toEqual("1/2/filec");
        expect(g.ls_files().length).toEqual(3);
      });

      it('should be able to add multiple sets of files', function() {
        g.init();
        createFilesFromTree({ "1": { "filea": "filea", "fileb": "fileb", "2":
                                { "filec": "filec", "3a":
                                  { "filed": "filed", "filee": "filee"}, "3b":
                                  { "filef": "filef", "fileg": "fileg"}}}});
        g.add("1/2/3a");
        expect(g.ls_files()[0]).toEqual("1/2/3a/filed");
        expect(g.ls_files()[1]).toEqual("1/2/3a/filee");
        expect(g.ls_files().length).toEqual(2);

        g.add("1/2/3b");
        expect(g.ls_files()[0]).toEqual("1/2/3a/filed");
        expect(g.ls_files()[1]).toEqual("1/2/3a/filee");
        expect(g.ls_files()[2]).toEqual("1/2/3b/filef");
        expect(g.ls_files()[3]).toEqual("1/2/3b/fileg");
        expect(g.ls_files().length).toEqual(4);
      });
    });
  });

  describe('update-index', function() {
    it('should throw if not in repo', function() {
      expect(function() { g.update_index(); })
        .toThrow("fatal: Not a gimlet repository (or any of the parent directories): .gimlet");
    });

    it('should return undefined if nothing specified', function() {
      g.init();
      expect(g.update_index()).toBeUndefined();
    });

    describe('pathspec stipulations', function() {
      it('should throw if path does not match existing working copy file', function() {
        g.init();
        expect(function() { g.update_index("blah"); })
          .toThrow("error: blah: does not exist\nfatal: Unable to process path blah");
      });

      it('should throw rel path if not in root and pathspec does not match file', function() {
        g.init();
        createFilesFromTree({ "1": { "2": {}}})
        process.chdir("1/2");
        expect(function() { g.update_index("blah"); })
          .toThrow("error: 1/2/blah: does not exist\nfatal: Unable to process path 1/2/blah");
      });

      it('should throw rel path if not in root and path is dir', function() {
        g.init();
        createFilesFromTree({ "1": { "2": {}}})
        process.chdir("1");
        expect(function() { g.update_index("2"); })
          .toThrow("error: 1/2: is a directory - add files inside instead\n" +
                   "fatal: Unable to process path 1/2");
      });
    });

    describe('adding files to index', function() {
      it('should add a file to an empty index and create object', function() {
        g.init();
        fs.writeFileSync("README.md", "this is a readme");
        g.update_index("README.md", { add: true });

        var readmeHash = g.hash_object("README.md");
        expect(fs.readFileSync(pathLib.join(".gimlet/objects", readmeHash), "utf8"))
          .toEqual("this is a readme");

        expect(g.ls_files()[0]).toEqual("README.md");
      });

      it('should add file to index with stuff in it', function() {
        g.init();
        createFilesFromTree({ "README1.md": "this is a readme1", "README2.md":"this is a readme2"});
        g.update_index("README1.md", { add: true });
        g.update_index("README2.md", { add: true });

        expect(fs.readFileSync(pathLib.join(".gimlet/objects", g.hash_object("README1.md")),
                               "utf8")).toEqual("this is a readme1");
        expect(fs.readFileSync(pathLib.join(".gimlet/objects", g.hash_object("README2.md")),
                               "utf8")).toEqual("this is a readme2");

        expect(g.ls_files()[0]).toEqual("README1.md");
        expect(g.ls_files()[1]).toEqual("README2.md");
      });

      it('should throw if try to add new file w/o --add flag', function() {
        g.init();
        fs.writeFileSync("README.md", "this is a readme");

        expect(function() { g.update_index("README.md"); })
          .toThrow("error: README.md: cannot add to the index - missing --add option?\n" +
                   "fatal: Unable to process path README.md");
      });

      it('should still refer to staged version if file changes after stage', function() {
        g.init();
        fs.writeFileSync("README.md", "this is a readme");
        var origContentHash = g.hash_object("README.md");
        g.update_index("README.md", { add: true });
        fs.writeFileSync("README.md", "this is a readme1");

        expect(fs.readFileSync("README.md", "utf8")).toEqual("this is a readme1");
        expect(g.ls_files({ stage: true })[0].split(" ")[1]).toEqual(origContentHash);
      });

      it('should update file hash in index and add new obj if update file', function() {
        g.init();
        fs.writeFileSync("README.md", "this is a readme");
        g.update_index("README.md", { add: true });
        expect(g.ls_files({ stage: true })[0].split(" ")[1])
          .toEqual(g.hash_object("README.md")); // sanity check hash added for first version

        // update file and update index again
        fs.writeFileSync("README.md", "this is a readme1");
        g.update_index("README.md");

        var newVersionHash = g.ls_files({ stage: true })[0].split(" ")[1];

        expect(fs.readFileSync(pathLib.join(".gimlet/objects", newVersionHash), "utf8"))
               .toEqual("this is a readme1");
        expect(newVersionHash).toEqual(g.hash_object("README.md"));
      });
    });
  });

  describe('ls-files', function() {
    it('should throw if not in repo', function() {
      expect(function() { g.update_index(); })
        .toThrow("fatal: Not a gimlet repository (or any of the parent directories): .gimlet");
    });

    it('should return no files if nothing in index', function() {
      g.init();
      expect(g.ls_files()).toEqual([]);
    });

    it('should return files in index', function() {
      g.init();
      createFilesFromTree({ "README1.md": "this is a readme1", "README2.md": "this is a readme2"});
      g.update_index("README1.md", { add: true });
      g.update_index("README2.md", { add: true });

      expect(g.ls_files()[0]).toEqual("README1.md");
      expect(g.ls_files()[1]).toEqual("README2.md");
    });

    it('should not return files not in index', function() {
      g.init();
      createFilesFromTree({ "README1.md": "this is a readme1", "README2.md": "this is a readme2"});
      g.update_index("README1.md", { add: true });

      expect(g.ls_files()[0]).toEqual("README1.md");
      expect(g.ls_files().length).toEqual(1);
    });

    it('should include full path in returned entries', function() {
      g.init();
      createFilesFromTree({ "src": { "README1.md": "this is a readme1"}});
      g.update_index("src/README1.md", { add: true });

      expect(g.ls_files()[0]).toEqual("src/README1.md");
    });

    it('should return files with hashes if --stage passed', function() {
      g.init();
      createFilesFromTree({ "README1.md": "this is a readme1", "README2.md": "this is a readme2"});
      g.update_index("README1.md", { add: true });
      g.update_index("README2.md", { add: true });

      expect(g.ls_files({stage: true})[0]).toEqual("README1.md " +g.hash_object("README1.md"));
      expect(g.ls_files({stage: true})[1]).toEqual("README2.md " +g.hash_object("README2.md"));
    });
  });

  describe('write-tree', function() {
    it('should throw if not in repo', function() {
      expect(function() { g.write_tree(); })
        .toThrow("fatal: Not a gimlet repository (or any of the parent directories): .gimlet");
    });
    it('should write-tree of empty root tree if no files staged', function() {
      g.init();
      expect(g.write_tree()).toEqual("3f2");
      expectFile(".gimlet/objects/3f2", "\n");
    });
  });
});

var rmdirSyncRecursive = function(dir) {
  fs.readdirSync(dir).forEach(function(fileName) {
    var filePath = pathLib.join(dir, fileName);
    if (fs.statSync(filePath).isDirectory()) {
      rmdirSyncRecursive(filePath);
    } else {
      fs.unlinkSync(filePath);
    }
  });

  fs.rmdirSync(dir);
};

var createFilesFromTree = function(structure, prefix) {
  if (prefix === undefined) return createFilesFromTree(structure, process.cwd());

  Object.keys(structure).forEach(function(name) {
    var path = pathLib.join(prefix, name);
    if (typeof structure[name] === "string") {
      fs.writeFileSync(path, structure[name]);
    } else {
      fs.mkdirSync(path, "777");
      createFilesFromTree(structure[name], path);
    }
  });
};
