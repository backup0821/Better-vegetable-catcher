from flask import Flask, request, jsonify
import json
import os

app = Flask(__name__)

@app.route('/save-subscription', methods=['POST'])
def save_subscription():
    try:
        data = request.json
        device_id = data.get('deviceId')
        subscription = data.get('subscription')
        
        if not device_id or not subscription:
            return jsonify({'error': '缺少必要參數'}), 400
        
        # 讀取現有訂閱資訊
        try:
            with open('subscriptions.json', 'r') as f:
                subscriptions = json.load(f)
        except FileNotFoundError:
            subscriptions = {}
        
        # 更新訂閱資訊
        subscriptions[device_id] = subscription
        
        # 儲存訂閱資訊
        with open('subscriptions.json', 'w') as f:
            json.dump(subscriptions, f, indent=2)
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000) 