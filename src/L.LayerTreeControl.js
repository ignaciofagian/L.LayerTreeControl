L.Control.LayerTreeControl = L.Control.extend({
  _map: null,
  _layers: null,
  options: {
    position: 'topright',
    renderLegends: true,
  },
  initialize: function (layers, options) {
    L.Util.setOptions(this, options);

    this._layers = layers;
  },

  addLayer: function (layerObj) {

    this._layers.push(layerObj);
    const layerId = 'layertree-' + L.stamp(layerObj);
    const layerName = layerObj.name;
    var treeLeafUI = this._treeLeafUI;
    const esriProvider = this._esriProvider;
    const leafletProvider = this._leafletProvider;
    const treeContainer = this._treeContainer;

    // esriDynamic type
    if (layerObj.type === 'esriDynamic') {
      this._map.addLayer(layerObj.layer);
      // by creating a placeholder div here, we ensure the order of layers is preserved while the data is fetched
      const container = L.DomUtil.create('div', '', treeContainer);
      esriProvider.getTree(layerId, layerName, layerObj).then(function (layersTree) {
        treeLeaf = treeLeafUI.render(layersTree, container);
      });
    }
    // leaflet type
    else if (layerObj.type === 'leaflet') {
      var opts = {};
      if (layerObj.children || layerObj.legend) {
        opts.children = layerObj.children;
        opts.legend = layerObj.legend;
      } else {
        opts = layerObj.layer.options;
        opts.layer = layerObj.layer;
      }

      leafletProvider.getTree(layerId, layerName, opts).then(function (layersTree) {
        treeLeaf = treeLeafUI.render(layersTree, treeContainer);
      });
    }
    // esriFeature type
    else if (layerObj.type === 'esriFeature') {
      // by creating a placeholder div here, we ensure the order of layers is preserved while the data is fetched
      const container = L.DomUtil.create('div', '', treeContainer);
      this._map.addLayer(layerObj.layer);
      esriProvider.getTree(layerId, layerName, layerObj).then(function (layersTree) {
        treeLeaf = treeLeafUI.render(layersTree, container);
      });
    }
  },

  onAdd: function (map) {
    var container = L.DomUtil.create('div', 'layer-tree-control');
    this._treeContainer = L.DomUtil.create('div', '', container);
    this._esriProvider = new EsriProvider(map);
    this._leafletProvider = new LeafletProvider(map);

    this._map = map;
    this._container = container;
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.on(container, 'dblclick', L.DomEvent.stopPropagation);
    L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
    L.DomEvent.on(container, 'wheel', L.DomEvent.stopPropagation);

    var providers = {
      esri: this._esriProvider,
      leaflet: this._leafletProvider,
    };

    var layerManager = new LayerManager(this._layers, providers, map);
    var treeLeafUI = new TreeLeafUI(layerManager, this.options.renderLegends);
    this._treeLeafUI = treeLeafUI;

    for (var i in this._layers) {
      const layerObj = this._layers[i];
      this.addLayer(layerObj);
    }

    return this._container;
  },
});

/**
 * Layer management
 */
function LayerManager(layers, providers, map) {
  var getLayerById = function (layerId) {
    var layer;
    for (var i in layers) {
      layer = layers[i].layer;
      if ('layertree-' + L.stamp(layers[i]) === layerId) {
        return layers[i];
      }
    }
  };

  var turnLayersMultiple = function (layerId, addSubLayersIds, delSubLayersIds) {
    var main = getLayerById(layerId);
    updateActiveLayers(main, addSubLayersIds, delSubLayersIds);
  };

  var turnParentsOn = function (layerId, subNodeId) {
    if (layerId === subNodeId) {
      // no parents
      return;
    }
    var layerNode = document.querySelectorAll('[data-id="' + layerId + '"]')[0];
    var layerChildNode = layerNode.nextElementSibling;
    var subNode = layerChildNode.querySelectorAll('[data-id="' + subNodeId + '"]')[0];

    var parentId = subNode.getElementsByClassName('check-box')[0].parentId;
    var parentNode = layerChildNode.querySelectorAll('[data-id="' + parentId + '"]')[0];

    var parentCheckBox;
    if (parentId !== layerId) {
      parentCheckBox = parentNode.getElementsByClassName('check-box')[0];
    } else {
      parentCheckBox = layerNode.getElementsByClassName('check-box')[0];
    }
    parentCheckBox.checked = true;

    if (parentId !== layerId) {
      turnParentsOn(layerId, parentId);
    }
  };

  var turnNodeOn = function (layerId, nodeId) {
    var layerNode = document.querySelectorAll('[data-id="' + layerId + '"]')[0].nextElementSibling;
    var findInNode;

    if (layerId !== nodeId) {
      findInNode = layerNode.querySelectorAll('[data-id="' + nodeId + '"]')[0].nextElementSibling;
    } else findInNode = layerNode;

    var allCheckboxes = findInNode.querySelectorAll('.check-box');

    var checkState = { [nodeId]: true };
    var layersOn = [];
    var layersOff = [];
    for (var i = 0; i < allCheckboxes.length; i++) {
      var checkbox = allCheckboxes[i];
      var isLeaf = L.DomUtil.hasClass(checkbox.parentElement.parentElement, 'leaf-header')
        ? true
        : false;
      if (isLeaf) {
        if (checkState[checkbox.parentId]) {
          if (checkbox.checked) {
            layersOn.push(parseInt(checkbox.itemId));
          }
        } else {
          layersOff.push(parseInt(checkbox.itemId));
        }
      } else {
        checkState[checkbox.itemId] = checkbox.checked;
      }
    }

    turnLayersMultiple(layerId, layersOn, layersOff);
  };

  var turnNodeOff = function (layerId, nodeId) {
    var layerNode = document.querySelectorAll('[data-id="' + layerId + '"]')[0].nextElementSibling;
    var findInNode;

    if (layerId !== nodeId) {
      findInNode = layerNode.querySelectorAll('[data-id="' + nodeId + '"]')[0].nextElementSibling;
    } else findInNode = layerNode;

    var allCheckboxes = findInNode.querySelectorAll('.check-box');
    var layersOff = [nodeId];

    for (var i = 0; i < allCheckboxes.length; i++) {
      var checkbox = allCheckboxes[i];
      var isLeaf = L.DomUtil.hasClass(checkbox.parentElement.parentElement, 'leaf-header')
        ? true
        : false;
      if (isLeaf && checkbox.checked) {
        layersOff.push(parseInt(checkbox.itemId));
      }
    }
    turnLayersMultiple(layerId, [], layersOff);
  };

  var updateActiveLayers = function (layerObj, addSubLayersIds, delSubLayersIds) {
    if (layerObj.type === 'esriDynamic' || layerObj.type === 'esriFeature') {
      providers.esri.updateActiveLayers(layerObj, addSubLayersIds, delSubLayersIds);
    } else if (layerObj.type === 'leaflet') {
      providers.leaflet.updateActiveLayers(layerObj, addSubLayersIds, delSubLayersIds);
    }
  };

  return {
    turnLayersOn: function (layerId, subLayerIds) {
      turnLayersMultiple(layerId, subLayerIds, []);
      turnParentsOn(layerId, subLayerIds[0]);
    },
    turnLayersOff: function (layerId, subLayerIds) {
      turnLayersMultiple(layerId, [], subLayerIds);
    },
    turnNodeOn: function (layerId, nodeId) {
      turnNodeOn(layerId, nodeId);
      turnParentsOn(layerId, nodeId);
    },
    turnNodeOff: function (layerId, nodeId) {
      turnNodeOff(layerId, nodeId);
    },
  };
}

/**
 * Render UI elements, require a normalized tree
 */
function TreeLeafUI(layerManager, renderLegends) {
  var addCheckBox = function (node, mainLayerId, container) {
    var wrapper = L.DomUtil.create('label', 'tree-check', container);
    var checkbox = L.DomUtil.create('input', 'check-box', wrapper);
    var marker = L.DomUtil.create('span', 'check-mark', wrapper);

    checkbox.type = 'checkbox';
    checkbox.itemId = node.id;
    checkbox.parentId = node.parentId !== -1 ? node.parentId : mainLayerId;
    checkbox.checked = !!node.enabled;

    L.DomEvent.on(checkbox,	'change', function (event) {
        event.stopPropagation();
        var checked = event.target.checked;
        var subLayerIds = [node.id];

        if (node.type === 'leaf' && checked) {
          // By default when you check the box the plugin would expand the subtree. This seems super weird.
          // treeExpand(container.parentElement);
          layerManager.turnLayersOn(mainLayerId, subLayerIds);
        } else if (node.type === 'leaf') {
          layerManager.turnLayersOff(mainLayerId, subLayerIds);
        } else if (node.type === 'node' && checked) {
          // treeExpand(container.parentElement);
          layerManager.turnNodeOn(mainLayerId, node.id);
        } else {
          layerManager.turnNodeOff(mainLayerId, node.id);
        }
      },
      this,
    );
  };

  var addLabel = function (title, container) {
    var label = L.DomUtil.create('label', 'tree-label', container);
    var labelText = L.DomUtil.create('span', '', label);
    labelText.innerHTML = title;
  };

  var addLegend = function (legendInfo, container, level) {
    if (legendInfo === undefined) return;
    if (!renderLegends) return;
    // legends: Array<{label, data}>
    function createLegend(legend, showLabel, dom, level) {
      var content = L.DomUtil.create('div', 'legend', dom);
      addLevelSpace(content, level);
      var img = L.DomUtil.create('img', 'legend-img', content);
      img.src = legend.imageData ? 'data:image/jpeg;base64,' + legend.imageData : legend.imageUrl;
      img.alt = 'legend';

      if (showLabel) {
        var label = L.DomUtil.create('span', 'legend-label', content);
        label.innerHTML = legend.label;
      }
    }
    // display multiple legends in new row
    var legends = legendInfo;
    var isFromImage = legends.largeImageUrl !== undefined;
    if (isFromImage) {
      var childrenNode = container.getElementsByClassName('tree-children')[0];
      var content = L.DomUtil.create('div', 'legend', childrenNode);
      addLevelSpace(content, level + 1);
      var wrapper = L.DomUtil.create('div', 'legend-image', content);

      var img = L.DomUtil.create('img', 'image', wrapper);
      img.src = legends.largeImageUrl;
    }
    // multiple legend lines
    else if (legends.length > 1) {
      var childrenNode = container.getElementsByClassName('tree-children')[0];
      var wrapper = L.DomUtil.create('div', 'legend-list', childrenNode);
      for (var i = 0; i < legends.length; i++) {
        createLegend(legends[i], true, wrapper, level + 1);
      }
    }
    // display single legend on same line
    else {
      var checkBoxNode = container.getElementsByClassName('check-box')[0];
      var legendSmNode = L.DomUtil.create('div', 'tree-legend-sm');
      // append after
      checkBoxNode.after(legendSmNode);
      createLegend(legends[0], false, legendSmNode, 0);
    }
  };

  var addTreeNode = function (container) {
    var img = L.DomUtil.create('div', 'tree-icon plus', container);
    img.alt = 'plus';
  };

  var addChildrenContainer = function (container) {
    var childContainer = L.DomUtil.create('div', 'tree-children hidden', container);
    return childContainer;
  };

  var getChildrenContainer = function (nodeId, container) {
    var headerNode = container.querySelectorAll('[data-id="' + nodeId + '"]')[0];
    var treeNode = headerNode.parentElement;
    return treeNode.getElementsByClassName('tree-children')[0];
  };

  var treeExpand = function (treeNode) {
    var iconNode = treeNode.getElementsByClassName('tree-icon')[0];
    var childrenNode = treeNode.getElementsByClassName('tree-children')[0];
    if (iconNode) {
      L.DomUtil.removeClass(childrenNode, 'hidden');
      L.DomUtil.addClass(iconNode, 'minus');
      L.DomUtil.removeClass(iconNode, 'plus');
    }
  };

  var treeCollapse = function (treeNode) {
    var iconNode = treeNode.getElementsByClassName('tree-icon')[0];
    var childrenNode = treeNode.getElementsByClassName('tree-children')[0];
    L.DomUtil.addClass(childrenNode, 'hidden');
    L.DomUtil.addClass(iconNode, 'plus');
    L.DomUtil.removeClass(iconNode, 'minus');
  };

  var navigateTree = function (mainLayerId, node, container, level = 1) {
    if (node.type === 'leaf') {
      this.renderLeaf(node, mainLayerId, container, level);
    }
    //
    else {
      this.renderNode(node, mainLayerId, container, level);

      for (var i = 0; i < node.children.length; i++) {
        var childrenContainer = getChildrenContainer(node.id, container);
        navigateTree.call(this, mainLayerId, node.children[i], childrenContainer, level + 1);
      }
    }
  };

  var addLevelSpace = function (container, total) {
    for (var i = 1; i < total; i++) {
      L.DomUtil.create('div', 'space', container);
    }
  };

  return {
    render(tree, container) {
      var mainLayerId = tree.id;
      navigateTree.call(this, mainLayerId, tree, container);
    },

    renderLeaf: function (node, mainLayerId, container, level) {
      var leafNode = L.DomUtil.create('div', 'tree-layer', container);
      var leafHeader = L.DomUtil.create('div', 'leaf-header', leafNode);
      leafHeader.setAttribute('data-id', node.id);
      var legendInfo = node.legend;
      var hasMultipleLegends = legendInfo && (legendInfo.length > 1 || legendInfo.largeImageUrl);

      addLevelSpace(leafHeader, level);
      addCheckBox(node, mainLayerId, leafHeader);
      if (hasMultipleLegends) {
        this.renderLeafNode(node, leafHeader, leafNode);
      }
      addLegend(node.legend, leafNode, level);
      addLabel(node.label, leafHeader);

      L.DomEvent.on(leafHeader, 'click', function (event) {
        event.stopPropagation();
        if (hasMultipleLegends === false) {
          var checkBoxNode = leafHeader.getElementsByClassName('check-box')[0];
          var checked = checkBoxNode.checked;
          checkBoxNode.checked = !checked;

          var event = new Event('change');
          checkBoxNode.dispatchEvent(event);
        }
      });
    },

    renderLeafNode: function (node, leafHeader, leafNode) {
      addTreeNode(leafHeader);
      addChildrenContainer(leafNode);

      L.DomEvent.on(leafHeader, 'click', function (event) {
          var isCheckbox;
          isCheckbox = event.target.classList.contains('check-box');
          isCheckbox |= event.target.classList.contains('check-mark');
          if (isCheckbox) {
            return;
          }
          event.stopPropagation();
          var childrenNode = leafNode.getElementsByClassName('tree-children')[0];
          var childrenIsHidden = L.DomUtil.hasClass(childrenNode, 'hidden');
          if (childrenIsHidden) treeExpand(leafNode);
          else treeCollapse(leafNode);
        },
        this,
      );
    },

    renderNode: function (node, mainLayerId, container, level) {
      var treeNode = L.DomUtil.create('div', 'tree-node', container);
      var treeHeader = L.DomUtil.create('div', 'node-header', treeNode);
      treeHeader.setAttribute('data-id', node.id);

      addLevelSpace(treeHeader, level);
      addCheckBox(node, mainLayerId, treeHeader);
      addTreeNode(treeHeader);
      addLabel(node.label, treeHeader);
      addChildrenContainer(treeNode);

      L.DomEvent.on(treeHeader, 'click', function (event) {
          event.stopPropagation();
          var isCheckbox;
          isCheckbox = event.target.classList.contains('check-box');
          isCheckbox |= event.target.classList.contains('check-mark');
          if (isCheckbox) {
            return;
          }
          var childrenNode = treeNode.getElementsByClassName('tree-children')[0];
          var childrenIsHidden = L.DomUtil.hasClass(childrenNode, 'hidden');
          if (childrenIsHidden) treeExpand(treeNode);
          else treeCollapse(treeNode);
        },
        this,
      );
    },
  };
}

/**
 * Parse esri services and return a normalized tree
 */
function EsriProvider(map) {
  var getService = function (url, token) {
    return L.esri.service({
      url: url,
      token: token,
    });
  };

  var getLegend = function (service, context) {
    return new Promise(function (resolve, reject) {
      service.get('/legend', {}, function response(err, res) {
        if (err) reject(err);
        else resolve(res);
      }, context);
    });
  };

  var getInfo = function (service, context) {
    return new Promise(function (resolve, reject) {
      service.get('/', {}, function response(err, res) {
        if (err) reject(err);
        else resolve(res);
      }, context);
    });
  };

  var buildNode = function (layerNode, initialLayerIds) {
    var node = {};
    node.id = layerNode.id;
    node.type = 'node';
    node.label = layerNode.name;
    node.children = [];
    node.parentId = layerNode.parentLayerId;
    node.enabled = initialLayerIds[layerNode.id];

    return node;
  };

  var buildLeaf = function (layer, legends, initialLayerIds) {
    var leaf = {};
    leaf.id = layer.id;
    leaf.type = 'leaf';
    leaf.label = layer.name;
    leaf.legend = legends[layer.id] ? legends[layer.id].legend : null;
    leaf.parentId = layer.parentLayerId;
    leaf.enabled = initialLayerIds[layer.id];

    return leaf;
  };

  var getTree = function (subLayers, legends, current, initialLayerIds, subLayersAsObject) {
    if (current.subLayerIds) {
      var i, child, subLayerId;
      var node = buildNode(current, initialLayerIds);
      var children = node.children;
      for (i = 0; i < current.subLayerIds.length; i++) {
        subLayerId = current.subLayerIds[i];
        child = getTree(subLayers, legends, subLayersAsObject[subLayerId], initialLayerIds, subLayersAsObject);
        children.push(child);
      }
      return node;
    } else {
      return buildLeaf(current, legends, initialLayerIds);
    }
  };

  var buildMultiple = function (layerId, layerName, subLayers, legends, initialLayerIds, subLayersAsObject) {
    var i, tree, subTree, children;
    tree = buildNode({ name: layerName }, initialLayerIds);
    tree.id = layerId;
    children = tree.children;

    for (i = 0; i < subLayers.length; i++) {
      if (subLayers[i].parentLayerId === -1) {
        subTree = getTree(subLayers, legends, subLayers[i], initialLayerIds, subLayersAsObject);
        children.push(subTree);
      }
    }
    return tree;
  };

  var buildSingle = function (layerId, layerName, legends, initialLayerIds) {
    var layer = {};
    layer.id = layerId;
    layer.name = layerName;
    var tree = buildLeaf(layer, legends, initialLayerIds);
    return tree;
  };

  var getLayerInfo = function (serviceUrl, context) {
    // This is a little confusing, but we want to preserve either the "token" or "withCredentials" options, whichever might be used.
    // The confusing part is that esri.Service expects token to be passed as an option, but withCrednetials to be passed in the "context" of the get request.
    // Why that is, is unclear.
    var service = getService(serviceUrl, context && context.options.token);
    var legendsPromise = getLegend(service, context);
    var infoPromise = getInfo(service, context);

    // wait both promises
    return Promise.all([legendsPromise, infoPromise]).then(function ([legends, info]) {
      var layerInfo = {};
      layerInfo.legends = utils.convertToKeyValue(legends.layers, 'layerId');
      layerInfo.subLayers = info.layers;

      return layerInfo;
    });
  };

  var updateActiveLayersDynamic = function (layerObj, addSubLayersIds, delSubLayersIds) {
    var layer = layerObj.layer;
    var nextLayerIds = layer.getLayers();

    nextLayerIds = utils.addIfNotExists(nextLayerIds, addSubLayersIds);

    for (var i in delSubLayersIds) {
      nextLayerIds = nextLayerIds.filter(function (e) {
        return e !== delSubLayersIds[i];
      });
    }

    layer.setLayers(nextLayerIds);
  };

  var updateActiveLayersFeature = function (layerObj, addSubLayersIds, delSubLayersIds) {
    throw 'Not implemented';
  };

  return {
    getTree: function (layerId, layerName, info) {
      const layerObj = info.layer;
      const options = layerObj.options;
      var url = options.url;
      const initialLayerIds = {};
      if (info.visibleLayers) {
        for (const id of info.visibleLayers) {
          initialLayerIds[id] = true;
        }
      }
      let enabledSublayers;
      if (info.subLayersList) {
        enabledSublayers = {};
        for (const l of info.subLayersList) {
          enabledSublayers[l.id] = true;
        }
      }
      return getLayerInfo(url, layerObj).then(function (layerInfo) {
        var subLayers = layerInfo.subLayers;
        var legends = layerInfo.legends;
        if (subLayers && subLayers.length > 1) {
          const subLayersAsObject = {};
          // The previous code seemed to assume that the "id" values in the sublayers array referred to the index in the array itself.
          // But it doesn't.
          for (var i = subLayers.length -1; i >= 0; i--) {
            if (enabledSublayers && !enabledSublayers[subLayers[i].id]) {
              // We may be loaded from a web map that only wants to show certain sublayers as even available to choose from, let alone enabled
              // so honor that list.
              subLayers.splice(i, 1);
              continue;
            }
            subLayersAsObject[subLayers[i].id] = subLayers[i];
            if (info.allVisible) {
              initialLayerIds[subLayers[i].id] = true
            }
          }
          return buildMultiple(layerId, layerName, subLayers, legends, initialLayerIds, subLayersAsObject);
        } else {
          return buildSingle(layerId, layerName, legends, initialLayerIds);
        }
      });
    },

    updateActiveLayers: function (layerObj, addSubLayersIds, delSubLayersIds) {
      if (layerObj.type === 'esriDynamic') {
        updateActiveLayersDynamic(layerObj, addSubLayersIds, delSubLayersIds);
      } else {
        updateActiveLayersFeature(layerObj, addSubLayersIds, delSubLayersIds);
      }
    },
  };
}

/**
 * Parse default services and return a normalized tree
 */
function LeafletProvider(map) {
  var buildNode = function (layerNode) {
    var node = {};
    node.id = layerNode.id;
    node.type = 'node';
    node.label = layerNode.name;
    node.children = [];
    node.parentId = layerNode.parentId;

    return node;
  };

  var buildLeaf = function (layer, legend) {
    var legendInfo;
    if (legend !== undefined) {
      if (Array.isArray(legend)) {
        legendInfo = legend;
      }
      // large
      else if (legend.largeImageUrl) {
        legendInfo = legend;
      }
      // default
      else {
        var legendItem = {};
        legendItem.imageUrl = legend;
        legendInfo = [legendItem];
      }
    }

    var leaf = {};
    leaf.id = layer.id;
    leaf.type = 'leaf';
    leaf.label = layer.name;
    leaf.legend = legend;
    leaf.parentId = layer.parentId;
    leaf.legend = legendInfo;

    return leaf;
  };

  var getTree = function (current) {
    if (current.children) {
      var i, child, nodeInfo;
      var node = buildNode(current);
      for (i = 0; i < current.children.length; i++) {
        nodeInfo = current.children[i];
        nodeInfo.parentId = current.id;
        nodeInfo.id = createId(current.id, i);
        child = getTree(nodeInfo);
        node.children.push(child);
      }
      return node;
    } else {
      // check legend
      var legend = current.legend;
      if (legend === undefined) {
        legend = getLegend(current.layer);
      }
      return buildLeaf(current, legend);
    }
  };

  var getLegend = function (layer) {
    if (layer._url !== undefined) {
      var serviceLayers = '';
      if (layer.wmsParams) {
        serviceLayers = layer.wmsParams.layers;
      }

      var url = new URL(layer._url);
      url.searchParams.set('service', 'WMS');
      url.searchParams.set('request', 'GetLegendGraphic');
      url.searchParams.set('format', 'image/png');
      url.searchParams.set('layer', serviceLayers);

      var legend = {};
      legend.largeImageUrl = `${url.toString()}`;
      return legend;
    }
    // default
    return undefined;
  };

  var createId = function (mainId, id) {
    return mainId * 1000 + id;
  };

  var getLayersFromTree = function (ids, tree) {
    if (ids.indexOf(tree.id) !== -1) {
      return [tree.layer];
    }
    var layers = [];
    for (var i in tree.children) {
      // prune predicate
      if (layers.length !== ids.length) {
        layers = layers.concat(getLayersFromTree(ids, tree.children[i]));
      }
    }
    return layers;
  };

  var addLayers = function (layers) {
    for (var i in layers) {
      map.addLayer(layers[i]);
    }
  };

  var removeLayers = function (layers) {
    for (var i in layers) {
      map.removeLayer(layers[i]);
    }
  };

  return {
    getTree: function (layerId, layerName, options) {
      if (options.children) {
        var i, tree, subTree, nodeInfo, children;

        tree = buildNode({ name: layerName, id: layerId });
        children = tree.children;

        for (i = 0; i < options.children.length; i++) {
          nodeInfo = options.children[i];
          nodeInfo.parentId = layerId;
          nodeInfo.id = createId(layerId, i);
          subTree = getTree(nodeInfo, {});
          children.push(subTree);
        }
        return new Promise(function (resolve) {
          resolve(tree);
        });
      }

      if (!options.legend) {
        options.legend = getLegend(options.layer);
      }
      return new Promise(function (resolve) {
        var layerInfo = {};
        layerInfo.id = layerId;
        layerInfo.name = layerName;

        var leaf = buildLeaf(layerInfo, options.legend);
        resolve(leaf);
      });
    },

    updateActiveLayers: function (layerObj, addSubLayersIds, delSubLayersIds) {
      if (layerObj.children) {
        var add = getLayersFromTree(addSubLayersIds, layerObj);
        var remove = getLayersFromTree(delSubLayersIds, layerObj);

        removeLayers(remove);
        addLayers(add);
      }
      // single layer
      else {
        if (addSubLayersIds.length !== 0) addLayers([layerObj.layer]);
        else removeLayers([layerObj.layer]);
      }
    },
  };
}

var utils = {
  convertToKeyValue: function (values, keyField) {
    var i,
      key,
      obj = {};
    for (i in values) {
      key = values[i][keyField];
      obj[key] = values[i];
    }
    return obj;
  },

  addIfNotExists: function (array, items) {
    for (var i in items) {
      array = array
        .filter(function (e) {
          return e !== items[i];
        })
        .concat([items[i]]);
    }
    return array;
  },
};

L.control.layerTreeControl = function (layers, options) {
  return new L.Control.LayerTreeControl(layers, options);
};
