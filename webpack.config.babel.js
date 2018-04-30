const path = require('path'),
  dirName = path.resolve('./'),
  webpack = require('webpack'),
  UglifyJsPlugin = require('uglifyjs-webpack-plugin');

function createConfig(isDebug, options = { outputPath: '', banner: '' }) {
  let devTool = '',
    plugins = [];

  const appEntry = {
    index: ['./_src/index.js'],
    light: ['./_src/light.js'],

    'volumeteric-light': ['./_src/volumeteric-light.js'],
    'point-light': ['./_src/point-light.js']
  };

  if (isDebug) {
    devTool = 'eval-source-map';

    // https://www.npmjs.com/package/uglifyjs-webpack-plugin
    plugins.push(
      new UglifyJsPlugin({
        sourceMap: false,
        uglifyOptions: {
          warnings: true,
          compress: {
            drop_console: false,
            unused: false,
            warnings: true
          },
          mangle: false,
          output: {
            beautify: true,
            comments: true
          }
        }
      }),
      new webpack.HotModuleReplacementPlugin()
    );
  } else {
    devTool = 'source-map';

    plugins.push(
      new UglifyJsPlugin({
        sourceMap: false,
        uglifyOptions: {
          warnings: true,
          compress: {
            drop_console: true,
            unused: true,
            warnings: true
          },
          mangle: true,
          output: {
            beautify: false,
            comments: false
          }
        }
      }),
      new webpack.BannerPlugin({
        banner: options.banner || '',
        raw: true
      })
    );
  }

  const outputPath = options.outputPath ? path.resolve(dirName, options.outputPath) : path.resolve(dirName, 'js');

  return {
    target: 'web',

    entry: appEntry,

    output: {
      path: outputPath,
      filename: '[name].js'
    },

    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          loader: 'babel-loader'
        },

        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          loader: 'eslint-loader'
        }
      ]
    },

    devtool: devTool,

    externals: {},

    plugins: plugins,

    devServer: {
      contentBase: './',
      noInfo: false,
      port: 9001,
      hot: true,
      inline: true
    }
  };
}

module.exports = createConfig;
