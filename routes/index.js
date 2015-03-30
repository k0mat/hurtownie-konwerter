var express = require('express');
var router = express.Router();
var ObjectID = require('mongodb').ObjectID;
var js2xmlparser = require("js2xmlparser");

var acceptedExtension = ["csv", "xls", "xlsx"];
var extension = "";


/* GET root page*/
router.get('/', function(req, res) {
	render(res, req.db, {title : 'Konwerter'})
});

router.post('/', function(req, res, next) {
	
	if (req.busboy) {
		//sciagnia pliku przez biblioteke busboy
		req.pipe(req.busboy);
		var fileContent = "";
		req.busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
			var nameArr = filename.split('.');
			extension = nameArr[nameArr.length-1];
			
			if(acceptedExtension.indexOf(extension) == -1)
			{
				render(res, req.db, {title : 'Konwerter', message : 'File type ' + extension + ' is not supported'});
			}
			
			file.setEncoding('utf8');
			
			//wczytuje plik
			file.on('readable', function() {
				var chunk;
				while (null !== (chunk = file.read())) {
					fileContent = fileContent.concat(chunk);
				}
			});
			//po zakonczeniu wczytywania parsuje
			file.on('end', function() {
				var parsed;
				if(extension === "csv")
				{
					parsed = parseCSV(fileContent);
				}
				var dbEntry = {name : nameArr[0], filetype : extension, content : parsed};
				
				// Set our collection
				var collection = req.db.get('filecollection');
				
				 // Submit to the DB
				collection.insert(dbEntry, function (err, doc) {
					if (err) {
						// If it failed, return error
						res.send("There was a problem adding the information to the database.");
					}
					else {
						res.location("/");
						res.redirect("/file/" + dbEntry._id);
					}
				});
			});
		});
	} 
	
    
});

router.get('/file/:id', function(req, res) {
	var id = req.params.id;

	if(id.length != 24){
		render(res, req.db, {title : 'Konwerter', notFound: true});
		return;
	}
	
	var collection = req.db.get('filecollection');
	
	collection.findOne({"_id": id}, function(err, doc) {
        if (doc){
			render(res, req.db, {title : 'Konwerter', fileDetails: true, file : doc});
        } else {
			render(res, req.db, {title : 'Konwerter', notFound: true});
        }
    });
});

//JSON
router.get('/file/:id/json/:file', function (req, res, next) {
	var id = req.params.id;
	
	if(id.length != 24){
		res.status(404).send("File not found.");
		return;
	}
	
	var collection = req.db.get('filecollection');
	
	collection.findOne({"_id": id}, function(err, doc) {
        if (doc){
			delete doc._id;
			res.type('application/json'); 
            res.send(doc);
        } else {
            res.status(404).send("File not found.");
        }
    });

});


//XML
router.get('/file/:id/xml/:file', function (req, res, next) {
	var id = req.params.id;
	
	if(id.length != 24){
		res.status(404).send("File not found.");
		return;
	}
	
	var collection = req.db.get('filecollection');
	
	collection.findOne({"_id": id}, function(err, doc) {
        if (doc){
			delete doc._id;
			res.type('application/xml'); 
            res.send(js2xmlparser("file",doc));
        } else {
            res.status(404).send("File not found.");
        }
    });

});

//SQL
router.get('/file/:id/sql/:file', function (req, res, next) {
	var id = req.params.id;
	
	if(id.length != 24){
		res.status(404).send("File not found.");
		return;
	}
	
	var collection = req.db.get('filecollection');
	
	collection.findOne({"_id": id}, function(err, doc) {
        if (doc){
			delete doc._id;
			var sql = "";
			var i, j;
			for(i = 0; i < doc.content.length; ++i){
				var line = doc.content[i];
				var insert = "";
				var keys = [];
				var values = [];
				for (var k in line){
					if (typeof line[k] !== 'function') {
						keys.push(k);
						values.push(line[k]);
					}
				}
				insert += "INSERT INTO table ("
				var k = JSON.stringify(keys).replace("[","").replace("]", "");
				while(k.indexOf('"') != -1){
					k = k.replace('"', "");
				}
				insert += k;
				insert += ") VALUES (";
				var v = JSON.stringify(values).replace("[","").replace("]", "");
				while(v.indexOf('"') != -1){
					v = v.replace('"', "'");
				}
				insert += v;
				insert += ");\n";
				sql += insert;
			}
			res.type('application/sql'); 
            res.send(sql);
        } else {
            res.status(404).send("File not found.");
        }
    });

});

function parseCSV(fileContent){
	var csvObject = [];
	var lines = fileContent.split('\n');
	var i,j;
	for (i = 0; i < lines.length; ++i) {
		csvObject[i] = {};
		var columns = lines[i].split(';');
		for(j = 0; j < columns.length; ++j){
			csvObject[i]['field' + j] = columns[j];
		}
		
	}
	return csvObject;
}

function render(res, db, arg){
	var collection = db.get('filecollection');
	collection.find({},{limit:5,sort:{_id:-1}},function(e,docs){
		var index;
		var list = [];
		for (index = 0; index < docs.length; ++index) {
			list[index] = docs[index];
			
		}
		arg['recent'] = list;
		res.render('index', arg);
	});
}

module.exports = router;
