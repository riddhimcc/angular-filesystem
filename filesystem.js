/*
 * Filesystem Manager v1.0.0
 * https://github.com/behzadkhalili
 * Author: behzadkhalili behzadkhalili.online@gmail.com
 *
 * Licensed MIT
 */

angular.module('Filesystem', [])
    .factory('FileManager', function ($q, FileSystemManager, IndexedDBManager) {
        function getFileStorage() {
            if (FileSystemManager.isAvailable()) {
                return FileSystemManager;
            }
            if (IndexedDBManager.isAvailable()) {
                return IndexedDBManager;
            }
        }

        function getAllFilesInit() {
            var deferred = $q.defer();

            getFileStorage().getAllFilesInit().then(function (res) {
                deferred.resolve(res);
            });

            return deferred.promise;
        }

        function saveFile(url) {
            var deferred = $q.defer();

            getFileStorage().saveFile(url).then(function (res) {
                deferred.resolve(res);
            });

            return deferred.promise;
        }

        function getAllFiles() {
            return getFileStorage().getAllFiles();
        }

        function getFile(fileName) {
            var deferred = $q.defer();

            getFileStorage().getFile(fileName).then(function (res) {
                deferred.resolve(res);
            });

            return deferred.promise;
            ;
        }

        return {
            getAllFilesInit: getAllFilesInit,
            saveFile: saveFile,
            getAllFiles: getAllFiles,
            getFile: getFile
        };
    })

    .factory('FileSystemManager', function ($q, $window, $location, $timeout) {
        $window.requestFileSystem = $window.requestFileSystem || $window.webkitRequestFileSystem;

        var allFiles = {};
        var available = $window.requestFileSystem !== undefined;

        function isAvailable() {
            return available;
        }

        function getAllFilesInit() {
            var deferred = $q.defer();

            $window.requestFileSystem($window.TEMPORARY, 500 * 1024 * 1024, function (fileSystem) {
                var directoryReader = fileSystem.root.createReader();
                var reader = function () {
                    directoryReader.readEntries(function (result) {
                        if (!result.length) {
                            deferred.resolve(allFiles);
                        } else {
                            angular.forEach(result, function (data) {
                                if (data.isFile) {
                                    allFiles[data.name] = data.toURL();
                                }
                            });
                            reader();
                        }
                    });
                };
                reader();
            });

            return deferred.promise;
        }

        function saveFile(url) {
            var deferred = $q.defer();
            var blob;
            var fileName = getFileName(url);
            var xhr = new XMLHttpRequest();

            xhr.open('GET', url, true);
            xhr.responseType = 'blob';

            xhr.addEventListener('load', function () {
                if (xhr.status === 200) {
                    blob = xhr.response;

                    $window.requestFileSystem($window.TEMPORARY, 500 * 1024 * 1024, function (fileSystem) {
                        fileSystem.root.getFile(fileName, {create: true}, function (data) {
                            data.createWriter(function (writer) {
                                writer.write(blob);
                                allFiles[fileName] = data.toURL();
                                $timeout(function () {
                                    deferred.resolve(data.toURL());
                                }, 500)
                            });
                        });
                    });

                } else {
                    deferred.reject();
                }
            }, false);

            xhr.send();

            return deferred.promise;
        }

        function getFile(fileName) {
            var deferred = $q.defer();

            deferred.resolve(fileName);
            return deferred.promise;
        }

        function getAllFiles() {
            return allFiles;
        }

        return {
            allFiles: allFiles,
            isAvailable: isAvailable,
            getAllFilesInit: getAllFilesInit,
            saveFile: saveFile,
            getFile: getFile,
            getAllFiles: getAllFiles
        };
    })

    .factory('IndexedDBManager', function ($q, $window) {
        // $window.indexedDB = $window.indexedDB || $window.webkitIndexedDB || $window.mozIndexedDB || $window.OIndexedDB || $window.msIndexedDB;
        $window.IDBTransaction = $window.IDBTransaction || $window.webkitIDBTransaction || $window.mozIDBTransaction || $window.OIDBTransaction || $window.msIDBTransaction;
        $window.URL = $window.URL || $window.webkitURL;

        if ($window.IDBTransaction) {
            $window.IDBTransaction.READ_WRITE = $window.IDBTransaction.READ_WRITE || 'readwrite';
            $window.IDBTransaction.READ_ONLY = $window.IDBTransaction.READ_ONLY || 'readonly';
        }

        var allFiles = {};
        var available = $window.indexedDB !== undefined && $window.IDBTransaction !== undefined;
        var databaseName = 'allFiles';
        var documentName = 'files';

        function isAvailable() {
            return available;
        }

        function getAllFilesInit() {
            var deferred = $q.defer();

            var request = $window.indexedDB.open(databaseName);

            request.onupgradeneeded = function (event) {
                var database = event.target.result;

                if (!database.objectStoreNames.contains(documentName)) {
                    database.createObjectStore(documentName);
                }
            };

            request.onsuccess = function (event) {
                var database = event.target.result;
                var transaction = database.transaction([documentName], $window.IDBTransaction.READ_ONLY);
                var store = transaction.objectStore(documentName);
                var cursor = store.openCursor();

                cursor.onsuccess = function (e) {
                    var result = e.target.result;

                    if (result) {
                        allFiles[result.key] = window.URL.createObjectURL(result.value);
                        result.continue();
                    }

                };
                deferred.resolve(allFiles);
            };

            return deferred.promise;
        }

        function saveFile(url) {
            var deferred = $q.defer();

            var request = $window.indexedDB.open(databaseName);
            var fileName = getFileName(url);

            request.onupgradeneeded = function (event) {
                var database = event.target.result;

                if (!database.objectStoreNames.contains(documentName)) {
                    database.createObjectStore(documentName);
                }
            };

            request.onsuccess = function (event) {
                var blob;
                var database = event.target.result;
                var xhr = new XMLHttpRequest();

                xhr.open('GET', url, true);
                xhr.responseType = 'blob';

                xhr.addEventListener('load', function () {
                    if (xhr.status === 200) {
                        blob = xhr.response;
                        var transaction = database.transaction([documentName], $window.IDBTransaction.READ_WRITE);
                        var store = transaction.objectStore(documentName);
                        store.put(blob, fileName);

                        store.get(fileName).onsuccess = function (event) {
                            var imgFile = event.target.result;
                            var imgURL = $window.URL.createObjectURL(imgFile);

                            allFiles[fileName] = imgURL;

                            deferred.resolve(imgURL);
                        };
                    }
                }, false);


                xhr.send();
            };

            request.onerror = function (event) {
                deferred.reject();
            };

            return deferred.promise;
        }

        function getFile(fileName) {
            var deferred = $q.defer();

            var request = $window.indexedDB.open(databaseName);

            request.onupgradeneeded = function (event) {
                var database = event.target.result;

                if (!database.objectStoreNames.contains(documentName)) {
                    database.createObjectStore(documentName);
                }
            };

            request.onsuccess = function (event) {
                var database = event.target.result;

                var transaction = database.transaction([documentName], $window.IDBTransaction.READ_ONLY);
                var store = transaction.objectStore(documentName);
                var cursor = store.openCursor();

                cursor.onsuccess = function (e) {
                    var result = e.target.result;

                    if (result) {
                        if (fileName === result.key) {
                            var imgURL = $window.URL.createObjectURL(result.value);
                            deferred.resolve(imgURL);
                        }
                        result.continue();
                    }
                };
            };
            return deferred.promise;
        }

        function getAllFiles() {
            return allFiles;
        }

        return {
            allFiles: allFiles,
            isAvailable: isAvailable,
            getAllFilesInit: getAllFilesInit,
            saveFile: saveFile,
            getFile: getFile,
            getAllFiles: getAllFiles
        };
    });
