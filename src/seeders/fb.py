from facebook_scraper import get_posts
import requests
import os
from stat import *
import time
import datetime
from datetime import datetime
import json
from collections import defaultdict
import csv

prevTimestampDict = {}
nextTimestampDict = {}
prevTimestampDict = defaultdict(lambda: 0, prevTimestampDict)
nextTimestampDict = defaultdict(lambda: 0, nextTimestampDict)
row = [["data", "url", "media"]]

timestampfile = "fbtimestamp.txt"

if not os.path.exists(timestampfile):
    with open(timestampfile,"w+") as f:
        print("Timestamp File created since it didnt exist")

with open(timestampfile) as f:
    for line in f:
        (key, val) = line.split()
        prevTimestampDict[key] = val
        print("Account "+key+" last updated at "+datetime.utcfromtimestamp(float(val)).strftime('%Y-%m-%d %H:%M:%S'))

accounts = []
with open("fb_accounts.txt","r") as f:
    accounts = f.read().splitlines()

for account in accounts:
    print("Started scraping "+account)

    prev_latest_timestamp = float(prevTimestampDict[account])
    next_latest_timestamp = float(prevTimestampDict[account])
    
    try:
        for post in get_posts(account, pages=10):        
            posted_at = post['time']
            timestamp = time.mktime(posted_at.timetuple())
            if timestamp<=prev_latest_timestamp:
                print("old post")
                continue
            if timestamp>next_latest_timestamp:
                next_latest_timestamp=timestamp
            print(post) 
            print(post['post_id'])
            print(post['post_url'])
            url = post['image_lowquality']
            if not url:
                print('no image so checking for video')
                url = post['video']
                filename = post['post_id']+".mp4"
                if not url:
                    print('no video too :(')
                    continue
            
            row.append([post['post_url'], posted_at.isoformat(), url, post["post_text"]])

        
    except Exception as e:
            print(e)
            pass
    
    nextTimestampDict[account] = next_latest_timestamp

with open(timestampfile, 'w') as file:
    for key in nextTimestampDict :
        file.write(key+" "+str(nextTimestampDict[key])+"\n")
        print("Updated latest timestamp of "+key +" is :"+datetime.utcfromtimestamp(float(nextTimestampDict[key])).strftime('%Y-%m-%d %H:%M:%S'))

with open('posts.csv', 'w', newline='') as file:
    writer = csv.writer(file)
    writer.writerows(row)