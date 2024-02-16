
import csv
import logging
import socket
import time
import sys
from vna import send_cmd, receive_bytes, build_cmd


def ping_vna(s: socket.socket) -> bool:
    """
    :return: True if the VNA could be pinged, False otherwise.
    """
    try:
        # Ask the VNA to identify itself.
        send_cmd(s, cmd='*IDN?\n')
        # Read the response back.
        recv = s.recv(255)
        return True
    except:
        logging.exception('Error.')
        try:
            s.close()
        except:
            logging.exception('Error closing connection.')
        return False


def vna_s2p(s: socket.socket, fpath: str, vna_type) -> bool:
    # copy s2p file to computer

    # Save trace into .s2p file on the VNA
    s.send(build_cmd(cmd='MMEM:STOR:SNP "CryoIntS.s2p"\n'))

    # The transfer of data is an inconsistent task. This while loop was put in place to repeat it until the data is successfully written into a file
    for _ in range(1):
        if vna_type == 'E5061B':
            send_cmd(s, cmd='MMEM:TRAN? "CryoIntS.s2p"\n')
            print('Sent command: MMEM:TRAN? "CryoIntS.s2p"\n')

        elif vna_type == 'N9914A' or vna_type == 'N9913A':
            send_cmd(s, cmd='MMEM:DATA? "CryoIntS.s2p"\n')
            print('Sent command: MMEM:DATA? "CryoIntS.s2p"\n')

        numbytes, recv = receive_bytes(s)
        contents = recv.decode('utf-8')
        print(len(recv))

        lines = contents.rstrip().split('\r\n')

        with open(fpath, 'w', encoding='utf-8') as wf:
            for line in lines:
                wf.write(line+'\n')

        if abs(int(numbytes) - len(recv)) < 30:
            print('Success!')
            return True
        else:
            time.sleep(10)
            print('Trying again...')
            continue

    # return True #transfer is good, return True
    print('Transfer Failed...')
    return False


def vna_csv(s: socket.socket, fpath: str, vna_type) -> bool:
    s.send(build_cmd(cmd='MMEM:STOR:FDAT "CryoIntC.csv"\n'))

    for _ in range(1):

        # The transfer of data is an inconsistent task. This while loop was put in place to repeat it until the data is successfully written into a file
        # while True:
        if vna_type == 'E5061B':
            send_cmd(s, cmd='MMEM:TRAN? "CryoIntC.csv"\n')
            print('Sent command: MMEM:TRAN? "CryoIntC.csv"\n')

        elif vna_type == 'N9914A' or vna_type == 'N9913A':
            send_cmd(s, cmd='MMEM:DATA? "CryoIntC.csv"\n')
            print('Sent command: MMEM:DATA? "CryoIntC.csv"\n')


        numbytes, recv = receive_bytes(s)

        #recv = s.recv(20000000)  #recv data, arg sets max number of bytes
        contents = recv.decode('utf-8')

        # The transfer would first write some artifact type number usually something like #533281.
        # The following code removes the characters before the first '!' which marks the start of the information we want

        with open(fpath, 'w', encoding='utf-8') as csv_wf:
            for line in contents.split('\n'):
                csv_wf.write(line)

        if abs(int(numbytes) - len(recv)) < 30:
            print('Success!')
            return True
        else:
            time.sleep(10)
            print('Trying again...')
            continue

    print('Failed after 10 retries.')
    return False
