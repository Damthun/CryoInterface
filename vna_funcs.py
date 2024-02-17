import logging
import socket
import time
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


def vna_s2p(s: socket.socket, fpath: str, vna_info) -> bool:
    """
    Collect s2p file from VNA.
    :return: True if received # bytes is within 30 of expected, False otherwise.
    """
    termination_character = vna_info['Termination']
    save_snp_command = vna_info['Save_snp']
    file_transfer_command = vna_info['Grab_file']

    # Save trace into .s2p file on the VNA.
    s.send(build_cmd(cmd=f'{save_snp_command} "CryoIntS.s2p"{termination_character}'))
    # Loop not necessary, remnants from initial launch when data transfer was inconsistent.
    for _ in range(1):
        # Data transferring command from device to host , and '?' means query.
        send_cmd(s, cmd=f'{file_transfer_command}? "CryoIntS.s2p"{termination_character}')
        print(f'Sent command: {file_transfer_command}? "CryoIntS.s2p"{termination_character}')

        # Expected size of data, and received data.
        numbytes, recv = receive_bytes(s)
        # Convert data from bytes to string.
        contents = recv.decode('utf-8')
        # Use carriage return and newline characters to split file line by line.
        lines = contents.rstrip().split('\r\n')
        # Open and create file, writing it to computer.
        with open(fpath, 'w', encoding='utf-8') as wf:
            for line in lines:
                wf.write(line+'\n')
        # Ensure the sizes are the same.
        if abs(int(numbytes) - len(recv)) < 30:
            print('Success!')
            return True
        # If they're different, retry. shouldn't ever be a problem.
        else:
            time.sleep(10)
            print('Trying again...')
            continue

    print('Transfer Failed...')
    return False


def vna_csv(s: socket.socket, fpath: str, vna_info) -> bool:
    """
    Collect csv file from VNA.
    :return: True if received # bytes is within 30 of expected, False otherwise.
    """
    termination_character = vna_info['Termination']
    save_csv_command = vna_info['Save_csv']
    file_transfer_command = vna_info['Grab_file']

    # Save trace into .csv file on the VNA.
    s.send(build_cmd(cmd=f'{save_csv_command} "CryoIntC.csv"{termination_character}'))
    # Loop not necessary, remnants from initial launch when data transfer was inconsistent.
    for _ in range(1):
        # Data transferring command from device to host is MMEM:TRAN, and '?' means query.

        send_cmd(s, cmd=f'{file_transfer_command}? "CryoIntC.csv"{termination_character}')
        print(f'Sent command: {file_transfer_command}? "CryoIntC.csv"{termination_character}')

        # Expected size of data, and received data.
        numbytes, recv = receive_bytes(s)
        # Convert data from bytes to string.
        contents = recv.decode('utf-8')
        # Open and create file, writing split data to computer.
        with open(fpath, 'w', encoding='utf-8') as csv_wf:
            for line in contents.split('\n'):
                csv_wf.write(line)
        # Ensure the expected and received values are essentially the same.
        if abs(int(numbytes) - len(recv)) < 30:
            print('Success!')
            return True
        # Sleep if failed transfer.
        else:
            time.sleep(10)
            print('Trying again...')
            continue

    print('Transfer Failed...')
    return False
